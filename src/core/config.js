const { ActivityType } = require(`discord.js`);
const { prisma } = require(`../../prisma/prismadb`);
const { getRedisClient } = require(`./redis`);

const QUEUE_CONFIG_CACHE_KEY = `vdc:config:queue`;
const QUEUE_CONFIG_CACHE_TTL_SECONDS = 30 * 60;
const CONTROL_PANEL_MAP_POOL_KEY = `MAP_POOL`;
const CONTROL_PANEL_DISPLAY_KEY = `display_mmr`;

const DEFAULT_QUEUE_CONFIG = Object.freeze({
	enabled: true,
	health: {
		checkIntervalMs: 5000,
		dbTimeoutMs: 1000,
	},
	mapPool: [],
	perTierFlags: {},
	relaxSeconds: 180,
	recentSetTtlSeconds: 180,
	cancelThreshold: 80,
	vcCreate: true,
	matchSize: 5,
	maxScanPerBucket: 400,
	displayMmr: false,
});

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
		vcCreate: DEFAULT_QUEUE_CONFIG.vcCreate,
		matchSize: DEFAULT_QUEUE_CONFIG.matchSize,
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

	// Only coerce numeric strings to Number when it's safe to do so. Large
	// integers (like Discord snowflakes) can exceed Number's safe integer range
	// and will lose precision if converted. For integers we only convert when
	// Number.isSafeInteger(parsed) is true. For decimals we convert normally.
	if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
		const num = Number(trimmed);
		if (!Number.isNaN(num)) {
			// If it's a decimal, return as Number
			if (trimmed.includes(`.`)) return num;
			// For integers, only return Number when it's a safe integer
			if (Number.isSafeInteger(num)) return num;
		}
		// Otherwise fall through and return the original string to preserve exactness
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
			case `queue_relax_seconds`:
				if (typeof value === `number`) config.relaxSeconds = value;
				break;
			case `queue_recent_ttl_seconds`:
				if (typeof value === `number`) config.recentSetTtlSeconds = value;
				break;
			case `queue_cancel_threshold`:
				if (typeof value === `number`) config.cancelThreshold = value;
				break;
			case `queue_display_mmr`:
				if (typeof value === `boolean`) config.displayMmr = value;
				break;
			case `queue_vc_create`:
				if (typeof value === `boolean`) config.vcCreate = value;
				break;
			case `queue_match_size`:
				if (typeof value === `number`) config.matchSize = value;
				break;
			case `queue_max_scan_per_bucket`:
				if (typeof value === `number`) config.maxScanPerBucket = value;
				break;
			case `queue_map_pool`:
				if (Array.isArray(value)) config.mapPool = value;
				else if (typeof value === `string` && value.length) config.mapPool = [value];
				break;
			case `queue_scout_role_id`:
				if (value != null) config.scoutRoleId = String(value);
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
		where: { OR: [
			{ name: { startsWith: `queue_` } },
			{ name: `display_mmr` },
		] },
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

// TODO: Test without the block below?
// Keep persisted Redis payload small and stable. Only include known fields so
// old/unused keys are not reintroduced into Redis when the config is refreshed.
function sanitizeQueueConfigForRedis(config) {
	if (!config || typeof config !== `object`) return {};
	const out = {
		enabled: Boolean(config.enabled),
		// adminRoleId/staffRoleId intentionally omitted: permission now enforced via
		// Discord Manage Guild/Administrator permissions instead of role config
		health: {
			checkIntervalMs: Number(config?.health?.checkIntervalMs ?? DEFAULT_QUEUE_CONFIG.health.checkIntervalMs),
			dbTimeoutMs: Number(config?.health?.dbTimeoutMs ?? DEFAULT_QUEUE_CONFIG.health.dbTimeoutMs),
		},
		mapPool: Array.isArray(config.mapPool) ? config.mapPool.slice() : DEFAULT_QUEUE_CONFIG.mapPool.slice(),
		perTierFlags: config.perTierFlags && typeof config.perTierFlags === `object` ? { ...config.perTierFlags } : {},
		relaxSeconds: Number(config.relaxSeconds ?? DEFAULT_QUEUE_CONFIG.relaxSeconds),
		recentSetTtlSeconds: Number(config.recentSetTtlSeconds ?? DEFAULT_QUEUE_CONFIG.recentSetTtlSeconds),
		cancelThreshold: Number(config.cancelThreshold ?? DEFAULT_QUEUE_CONFIG.cancelThreshold),
		vcCreate: config.vcCreate === false ? false : true,
		matchSize: Number(config.matchSize ?? DEFAULT_QUEUE_CONFIG.matchSize),
		maxScanPerBucket: Number(config.maxScanPerBucket ?? DEFAULT_QUEUE_CONFIG.maxScanPerBucket),
		displayMmr: Boolean(config.displayMmr),
		scoutRoleId: typeof config.scoutRoleId === `string` && config.scoutRoleId.length ? config.scoutRoleId : undefined,
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
	const mapPool = await fetchGlobalMapPool();
	if (!Array.isArray(mapPool) || mapPool.length === 0) {
		throw new Error(`ControlPanel map pool (MAP_POOL) is empty or missing`);
	}
	copy.mapPool = mapPool;

	copy.displayMmr = await fetchDisplayMmrFallback(copy.displayMmr);
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

async function fetchDisplayMmrFallback(current) {
	if (typeof current === `boolean`) return current;

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
	PRESENCE: {
		STATUS: `online`,
		TYPE: ActivityType.Watching,
		MESSAGE: `travestey write bad code`,
	},
	GITHUB: `https://github.com/Valorant-Draft-Circuit/vdc-bot`,
	DEFAULT_QUEUE_CONFIG,
	getQueueConfig: loadQueueConfig,
	invalidateQueueConfigCache,
};
