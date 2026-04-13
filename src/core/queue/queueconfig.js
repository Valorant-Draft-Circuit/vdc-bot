//TODO: Cleanup this entire file

const { prisma } = require(`../../../prisma/prismadb`);
const { getRedisClient } = require(`../redis`);
const { QUEUE_CONFIG_CACHE_KEY } = require(`../../helpers/queue/queueKeys`);
const {
	CONTROL_PANEL_MAP_POOL_KEY,
	CONTROL_PANEL_DISPLAY_KEY,
	DEFAULT_QUEUE_CONFIG,
} = require(`./constants`);

const QUEUE_CONFIG_CACHE_TTL_SECONDS = 30 * 60;

let inMemoryQueueConfig = null;
let inMemoryQueueConfigExpiresAt = 0;
let lastFetchAttemptAt = 0;

function cloneDefaultQueueConfig() {
	return {
		enabled: DEFAULT_QUEUE_CONFIG.enabled,
		health: { ...DEFAULT_QUEUE_CONFIG.health },
		mapPool: DEFAULT_QUEUE_CONFIG.mapPool.slice(),
		perTierFlags: { ...DEFAULT_QUEUE_CONFIG.perTierFlags },
		relaxSeconds: DEFAULT_QUEUE_CONFIG.relaxSeconds,
		recentSetTtlSeconds: DEFAULT_QUEUE_CONFIG.recentSetTtlSeconds,
		cancelThreshold: DEFAULT_QUEUE_CONFIG.cancelThreshold,
		channelStopThreshold: DEFAULT_QUEUE_CONFIG.channelStopThreshold,
		matchmakerWarmupSeconds: DEFAULT_QUEUE_CONFIG.matchmakerWarmupSeconds,
		matchmakerWarmupMaxPopsPerTick: DEFAULT_QUEUE_CONFIG.matchmakerWarmupMaxPopsPerTick,
		matchmakerWarmupMinSecondsBetweenPops: DEFAULT_QUEUE_CONFIG.matchmakerWarmupMinSecondsBetweenPops,
		maxScanPerBucket: DEFAULT_QUEUE_CONFIG.maxScanPerBucket,
	};
}

function coerceControlPanelValue(rawValue) {
	if (rawValue == null) return null;

	const trimmed = String(rawValue).trim();
	if (!trimmed.length) return ``;

	if (trimmed.includes(`,`)) {
		return trimmed
			.split(`,`)
			.map((chunk) => chunk.trim())
			.filter(Boolean);
	}

	const lower = trimmed.toLowerCase();
	if (lower === `true` || lower === `false`) return lower === `true`;

	if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
		const num = Number(trimmed);
		if (!Number.isNaN(num)) {
			if (trimmed.includes(`.`)) return num;
			if (Number.isSafeInteger(num)) return num;
		}
		return trimmed;
	}

	return trimmed;
}

function hydrateConfigFromRows(rows) {
	const config = cloneDefaultQueueConfig();

	for (const row of rows) {
		const key = row.name ?? row.id ?? row.key;
		if (!key || !String(key).startsWith(`queue_`)) continue;

		const value = coerceControlPanelValue(row.value);

		switch (key) {
			case `queue_enabled`:
				if (typeof value === `boolean`) config.enabled = value;
				break;
			case `queue_health_check_interval_ms`:
				if (typeof value === `number`) config.health.checkIntervalMs = value;
				break;
			case `queue_health_db_timeout_ms`:
				if (typeof value === `number`) config.health.dbTimeoutMs = value;
				break;
			case `queue_channel_stop_threshold`:
				if (typeof value === `number`) config.channelStopThreshold = value;
				break;
			case `queue_max_scan_per_bucket`:
				if (typeof value === `number`) config.maxScanPerBucket = value;
				break;
			case `queue_new_player_game_req`:
				if (typeof value === `number`) config.newPlayerGameReq = value;
				break;
			case `queue_returning_game_req`:
				if (typeof value === `number`) config.returningPlayerGameReq = value;
				break;
			default:
				if (key.startsWith(`queue_open_`)) {
					const tierKey = key.replace(`queue_open_`, ``).toUpperCase();
					if (typeof value === `boolean`) config.perTierFlags[tierKey] = value;
				}
				break;
		}
	}

	return config;
}

async function fetchQueueConfigFromControlPanel() {
	const rows = await prisma.controlPanel.findMany({
		where: { name: { startsWith: `queue_` } },
	});

	return hydrateConfigFromRows(rows);
}

async function persistQueueConfigToRedis(config) {
	try {
		const redis = getRedisClient();
		const payload = sanitizeQueueConfigForRedis(config);
		await redis.set(QUEUE_CONFIG_CACHE_KEY, JSON.stringify(payload));
	} catch (error) {
		logger.log(`WARNING`, `Failed to persist queue config to Redis`, error);
	}
}

function sanitizeQueueConfigForRedis(config) {
	if (!config || typeof config !== `object`) return {};
	const out = {
		enabled: Boolean(config.enabled),
		health: {
			checkIntervalMs: Number(config?.health?.checkIntervalMs ?? DEFAULT_QUEUE_CONFIG.health.checkIntervalMs),
			dbTimeoutMs: Number(config?.health?.dbTimeoutMs ?? DEFAULT_QUEUE_CONFIG.health.dbTimeoutMs),
		},
		mapPool: Array.isArray(config.mapPool) ? config.mapPool.slice() : DEFAULT_QUEUE_CONFIG.mapPool.slice(),
		perTierFlags: config.perTierFlags && typeof config.perTierFlags === `object` ? { ...config.perTierFlags } : {},
		relaxSeconds: Number(config.relaxSeconds ?? DEFAULT_QUEUE_CONFIG.relaxSeconds),
		recentSetTtlSeconds: Number(config.recentSetTtlSeconds ?? DEFAULT_QUEUE_CONFIG.recentSetTtlSeconds),
		cancelThreshold: Number(config.cancelThreshold ?? DEFAULT_QUEUE_CONFIG.cancelThreshold),
		channelStopThreshold: Number(config.channelStopThreshold ?? DEFAULT_QUEUE_CONFIG.channelStopThreshold),
		matchmakerWarmupSeconds: Number(config.matchmakerWarmupSeconds ?? DEFAULT_QUEUE_CONFIG.matchmakerWarmupSeconds),
		matchmakerWarmupMaxPopsPerTick: Number(config.matchmakerWarmupMaxPopsPerTick ?? DEFAULT_QUEUE_CONFIG.matchmakerWarmupMaxPopsPerTick),
		matchmakerWarmupMinSecondsBetweenPops: Number(config.matchmakerWarmupMinSecondsBetweenPops ?? DEFAULT_QUEUE_CONFIG.matchmakerWarmupMinSecondsBetweenPops),
		maxScanPerBucket: Number(config.maxScanPerBucket ?? DEFAULT_QUEUE_CONFIG.maxScanPerBucket),
		displayMmr: typeof config.displayMmr === `boolean` ? config.displayMmr : false,
		mapPool: Array.isArray(config.mapPool) ? config.mapPool.slice() : DEFAULT_QUEUE_CONFIG.mapPool.slice(),
		newPlayerGameReq: Number.isInteger(config.newPlayerGameReq) ? config.newPlayerGameReq : undefined,
		returningPlayerGameReq: Number.isInteger(config.returningPlayerGameReq) ? config.returningPlayerGameReq : undefined,
	};

	return out;
}

async function readQueueConfigFromRedis() {
	try {
		const redis = getRedisClient();
		const payload = await redis.get(QUEUE_CONFIG_CACHE_KEY);
		if (!payload) return null;
		const parsed = JSON.parse(payload);
		const base = cloneDefaultQueueConfig();
		return {
			...base,
			...parsed,
			health: { ...base.health, ...(parsed.health ?? {}) },
			perTierFlags: { ...base.perTierFlags, ...(parsed.perTierFlags ?? {}) },
			mapPool: Array.isArray(parsed.mapPool) && parsed.mapPool.length
				? parsed.mapPool
				: base.mapPool.slice(),
		};
	} catch (error) {
		logger.log(`WARNING`, `Failed to read queue config from Redis`, error);
		return null;
	}
}

async function loadQueueConfig({ forceRefresh = false } = {}) {
	const now = Date.now();
	if (!forceRefresh && inMemoryQueueConfig && now < inMemoryQueueConfigExpiresAt) {
		return inMemoryQueueConfig;
	}

	if (!forceRefresh && now - lastFetchAttemptAt < 5000 && inMemoryQueueConfig) {
		return inMemoryQueueConfig;
	}

	if (!forceRefresh) {
		const cached = await readQueueConfigFromRedis();
		if (cached) {
			inMemoryQueueConfig = cached;
			inMemoryQueueConfigExpiresAt = now + QUEUE_CONFIG_CACHE_TTL_SECONDS * 1000;
			return cached;
		}
	}

	try {
		lastFetchAttemptAt = now;
		let fresh = await fetchQueueConfigFromControlPanel();
		fresh = await hydrateGlobalFallbacks(fresh);
		inMemoryQueueConfig = fresh;
		inMemoryQueueConfigExpiresAt = now + QUEUE_CONFIG_CACHE_TTL_SECONDS * 1000;
		await persistQueueConfigToRedis(fresh);
		return fresh;
	} catch (error) {
		logger.log(`ERROR`, `Unable to load queue configuration`, error);
		throw error;
	}
}

async function invalidateQueueConfigCache() {
	inMemoryQueueConfig = null;
	inMemoryQueueConfigExpiresAt = 0;

	try {
		const redis = getRedisClient();
		await redis.del(QUEUE_CONFIG_CACHE_KEY);
	} catch (error) {
		logger.log(`WARNING`, `Failed to invalidate queue config cache`, error);
	}
}

async function hydrateGlobalFallbacks(config) {
	const copy = { ...config };
	// MAP_POOL and display_mmr are global ControlPanel keys (not queue_* keys).
	const mapPool = await fetchGlobalMapPool();
	if (!Array.isArray(mapPool) || mapPool.length === 0) {
		throw new Error(`ControlPanel map pool (MAP_POOL) is empty or missing`);
	}
	copy.mapPool = mapPool;

	copy.displayMmr = await fetchDisplayMmrGlobal();
	return copy;
}

async function fetchGlobalMapPool() {
	try {
		const row = await prisma.controlPanel.findFirst({
			where: { name: CONTROL_PANEL_MAP_POOL_KEY },
			select: { value: true },
		});

		if (!row || row.value == null) {
			throw new Error(`ControlPanel map pool (MAP_POOL) is missing`);
		}
		const coerced = coerceControlPanelValue(row.value);

		if (Array.isArray(coerced)) return coerced.filter((entry) => typeof entry === `string` && entry.length);
		if (typeof coerced === `string` && coerced.length) {
			return [coerced];
		}

		throw new Error(`ControlPanel map pool (MAP_POOL) has invalid format`);
	} catch (error) {
		logger.log(`WARNING`, `Failed to fetch global map pool`, error);
		throw error;
	}
}

async function fetchDisplayMmrGlobal() {
	try {
		const row = await prisma.controlPanel.findFirst({
			where: { name: CONTROL_PANEL_DISPLAY_KEY },
			select: { value: true },
		});

		if (!row || row.value == null) return false;
		const coerced = coerceControlPanelValue(row.value);
		return typeof coerced === `boolean` ? coerced : false;
	} catch (error) {
		logger.log(`WARNING`, `Failed to fetch display_mmr`, error);
		return false;
	}
}

module.exports = {
	DEFAULT_QUEUE_CONFIG,
	getQueueConfig: loadQueueConfig,
	invalidateQueueConfigCache,
};
