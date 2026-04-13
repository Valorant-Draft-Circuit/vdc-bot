const { runLua, getRedisClient } = require(`../../core/redis`);
const { getQueueConfig } = require(`../../core/queue/queueconfig`);
const { generateQueueId } = require(`../../helpers/queue/id`);
const {
	QUEUE_BUCKETS,
	LEAGUE_STATE_KEY,
	TIERS_SET_KEY,
	EVENTS_STREAM_KEY,
	tierQueueKey,
	matchKey,
} = require(`../../helpers/queue/queueKeys`);

const { LUA_SCRIPT, STATIC_MATCH_SIZE } = require(`./constants`);
const { resolveWarmupEndsAt, buildWarmupState } = require(`./warmup`);
const { deriveTiersFromCache, parseLuaJson, runSafely } = require(`./util`);
const { ensureChannelCapacityForPops } = require(`./capacity`);
const { dispatchMatch } = require(`./dispatch`);

let intervalHandle;
let currentIntervalMs = null;
const inFlightTiers = new Set();
const lastTierError = new Map();
let startedAt = null;
let stoppedAt = null;
let stopReason = null;
let stopSource = null;
let warmupEndsAt = null;
let lastPopAt = null;

function isQueueSystemEnabledFromEnv() {
	return (/true/i).test(process.env.QUEUE_SYSTEM_ENABLED);
}

async function startMatchmaker(client, options = {}) {
	if (intervalHandle) return intervalHandle;

	if (!isQueueSystemEnabledFromEnv()) {
		logger.log(`INFO`, `Queue matchmaker start skipped because QUEUE_SYSTEM_ENABLED=false`);
		return null;
	}

	const config = await getQueueConfig({ forceRefresh: true }).catch(() => null);
	if (!config?.enabled) {
		logger.log(`INFO`, `Queue matchmaker start skipped because queue_enabled=false`);
		return null;
	}

	const intervalMs = Math.max(2000, Number(options.intervalMs ?? 2000));
	currentIntervalMs = intervalMs;
	const tick = () => runSafely(() => processAllTiers(client));

	intervalHandle = setInterval(tick, intervalMs);
	intervalHandle.unref?.();
	runSafely(() => processAllTiers(client));

	startedAt = Date.now();
	lastPopAt = null;
	stopReason = null;
	stopSource = null;
	warmupEndsAt = resolveWarmupEndsAt(config);

	if (warmupEndsAt) {
		const warmupSeconds = Math.max(0, Math.floor((warmupEndsAt - Date.now()) / 1000));
		logger.log(`INFO`, `Queue matchmaker started (interval ${intervalMs}ms, warmup ${warmupSeconds}s)`);
	} else {
		logger.log(`INFO`, `Queue matchmaker started (interval ${intervalMs}ms)`);
	}

	return intervalHandle;
}

function stopMatchmaker(options = {}) {
	const reason = options.reason || null;
	const source = options.source || null;

	if (!intervalHandle) return;

	clearInterval(intervalHandle);
	intervalHandle = undefined;
	stoppedAt = Date.now();
	stopReason = reason;
	stopSource = source;
	currentIntervalMs = null;
	warmupEndsAt = null;

	if (reason) {
		logger.log(`INFO`, `Queue matchmaker stopped (${reason})`);
	} else {
		logger.log(`INFO`, `Queue matchmaker stopped`);
	}
}

function getMatchmakerStatus() {
	const now = Date.now();
	const warmupActive = Boolean(warmupEndsAt && now < warmupEndsAt);
	const warmupRemainingSeconds = warmupActive ? Math.max(0, Math.ceil((warmupEndsAt - now) / 1000)) : 0;

	return {
		running: Boolean(intervalHandle),
		intervalMs: currentIntervalMs,
		startedAt,
		stoppedAt,
		stopReason,
		stopSource,
		warmupActive,
		warmupEndsAt,
		warmupRemainingSeconds,
		lastPopAt,
		inFlightTiers: inFlightTiers.size,
	};
}

function endWarmupNow(options = {}) {
	const source = options.source || `manual`;
	const activeBefore = Boolean(warmupEndsAt && Date.now() < warmupEndsAt);
	if (!warmupEndsAt) {
		return { changed: false, activeBefore: false, activeAfter: false };
	}

	warmupEndsAt = Date.now() - 1;
	const activeAfter = Boolean(warmupEndsAt && Date.now() < warmupEndsAt);
	logger.log(`INFO`, `Queue matchmaker warmup ended early (source=${source})`);

	return {
		changed: activeBefore,
		activeBefore,
		activeAfter,
	};
}

async function processAllTiers(client, options = {}) {
	const config = await getQueueConfig();
	if (!config.enabled) return;

	if (options.enforceCapacityGuard !== false) {
		const canContinue = await ensureChannelCapacityForPops(client, config, {
			isRunning: () => Boolean(intervalHandle),
			stopMatchmaker,
		});
		if (!canContinue) return;
	}

	const redis = getRedisClient();
	const tierSet = new Set(await redis.smembers(TIERS_SET_KEY));
	const warmup = buildWarmupState(config, options, warmupEndsAt);
	let popsThisTick = 0;

	if (tierSet.size === 0) {
		const fallback = deriveTiersFromCache();
		fallback.forEach((tier) => tierSet.add(tier));
	}

	for (const tier of tierSet) {
		if (!tier || tier === `pulled`) continue;

		if (warmup.active) {
			if (popsThisTick >= warmup.maxPopsPerTick) break;
			if (lastPopAt && Date.now() - lastPopAt < warmup.minSecondsBetweenPops * 1000) break;
		}

		const matched = await attemptMatchForTier(client, tier, config);
		if (matched) {
			popsThisTick += 1;
			lastPopAt = Date.now();
		}
	}
}

async function attemptMatchForTier(client, tier, config) {
	if (inFlightTiers.has(tier)) return false;
	inFlightTiers.add(tier);

	try {
		const queueId = await generateQueueId(getRedisClient());
		const keys = [
			LEAGUE_STATE_KEY,
			...QUEUE_BUCKETS.map((bucket) => tierQueueKey(tier, bucket)),
			matchKey(queueId),
			EVENTS_STREAM_KEY,
			...QUEUE_BUCKETS.map((bucket) => tierQueueKey(tier, bucket, { completed: true })),
		];

		const args = [
			tier,
			queueId,
			String(Date.now()),
			String(config.relaxSeconds ?? 180),
			String(config.recentSetTtlSeconds ?? config.relaxSeconds ?? 180),
			String(config.maxScanPerBucket ?? 400),
			String(STATIC_MATCH_SIZE),
		];

		const response = await runLua(LUA_SCRIPT, { keys, args });
		const payload = parseLuaJson(response);

		if (!payload.ok) {
			const errorCode = payload.error;
			if (errorCode === `INSUFFICIENT_QUEUE` || errorCode === `MATCH_BUILD_INCOMPLETE`) {
				lastTierError.set(tier, errorCode);
				return false;
			}

			if (lastTierError.get(tier) !== errorCode) {
				lastTierError.set(tier, errorCode);
				logger.log(`WARNING`, `Match build failed for ${tier}`, errorCode);
			}

			return false;
		}

		lastTierError.delete(tier);
		await dispatchMatch(client, payload, config);
		return true;
	} catch (error) {
		logger.log(`ERROR`, `Error building match for ${tier}`, error);
		return false;
	} finally {
		inFlightTiers.delete(tier);
	}
}

async function runMatchmakerOnce(client, tier) {
	if (!isQueueSystemEnabledFromEnv()) {
		logger.log(`INFO`, `Queue matchmaker one-shot skipped because QUEUE_SYSTEM_ENABLED=false`);
		return false;
	}

	const config = await getQueueConfig({ forceRefresh: true });
	if (!config.enabled) {
		logger.log(`INFO`, `Queue matchmaker one-shot skipped because queue_enabled=false (fresh config)`);
		return false;
	}

	if (tier && tier !== `ALL`) {
		await attemptMatchForTier(client, tier, config);
		return true;
	}

	await processAllTiers(client, { enforceCapacityGuard: false, bypassWarmup: true });
	return true;
}

module.exports = {
	startMatchmaker,
	stopMatchmaker,
	getMatchmakerStatus,
	endWarmupNow,
	runMatchmakerOnce,
};
