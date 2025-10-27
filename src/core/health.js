const { prisma } = require(`../../prisma/prismadb`);
const { getRedisClient } = require(`./redis`);
const { getQueueConfig } = require(`./config`);

const LEAGUE_STATE_KEY = `vdc:league_state`;
const COMBINES_STATE = `combines`;
const DEFAULT_INTERVAL_MS = 5000;

let monitorHandle;
let monitorIntervalMs = DEFAULT_INTERVAL_MS;
let lastStateSnapshot = {
	redisHealthy: null,
	dbHealthy: null,
	combinesActive: null,
	healthy: null,
};

async function pingRedis() {
	try {
		const redis = getRedisClient();
		await redis.ping();
		return true;
	} catch (error) {
		logger.log(`WARNING`, `Redis ping failed`, error);
		return false;
	}
}

async function pingDatabase(timeoutMs) {
	try {
		await Promise.race([
			prisma.$queryRaw`SELECT 1`,
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error(`DB_PING_TIMEOUT`)), timeoutMs),
			),
		]);

		return true;
	} catch (error) {
		if (error.message === `DB_PING_TIMEOUT`) {
			logger.log(`WARNING`, `Database ping timed out after ${timeoutMs}ms`);
		} else {
			logger.log(`WARNING`, `Database ping failed`, error);
		}

		return false;
	}
}

async function readLeagueState() {
	try {
		const redis = getRedisClient();
		const state = await redis.get(LEAGUE_STATE_KEY);
		return typeof state === `string` ? state.toLowerCase() : null;
	} catch (error) {
		logger.log(`WARNING`, `Unable to read league state`, error);
		return null;
	}
}

async function monitorTick() {
	const config = await getQueueConfig();
	const redisHealthy = await pingRedis();
	const dbHealthy = await pingDatabase(config.health.dbTimeoutMs);
	const leagueState = await readLeagueState();

	const combinesActive = leagueState === COMBINES_STATE;
	const healthy = redisHealthy && dbHealthy && config.enabled && combinesActive;

	if (
		lastStateSnapshot.redisHealthy !== redisHealthy ||
		lastStateSnapshot.dbHealthy !== dbHealthy ||
		lastStateSnapshot.combinesActive !== combinesActive ||
		lastStateSnapshot.healthy !== healthy
	) {
		lastStateSnapshot = { redisHealthy, dbHealthy, combinesActive, healthy };
		logger.log(`INFO`, `Queue health updated: ${JSON.stringify(lastStateSnapshot)}`);
	}

	const desiredInterval = Math.max(
		1000,
		Number(config.health?.checkIntervalMs) || DEFAULT_INTERVAL_MS,
	);
	if (desiredInterval !== monitorIntervalMs) {
		rescheduleMonitor(desiredInterval);
	}
}

function rescheduleMonitor(newInterval) {
	monitorIntervalMs = newInterval;

	if (monitorHandle) {
		clearInterval(monitorHandle);
		monitorHandle = setInterval(
			() => monitorTick().catch((error) => logger.log(`ERROR`, `Queue health tick failed`, error)),
			monitorIntervalMs,
		);
		monitorHandle.unref?.();
	}
}

function startHealthMonitor() {
	if (monitorHandle) return monitorHandle;

	monitorHandle = setInterval(
		() => monitorTick().catch((error) => logger.log(`ERROR`, `Queue health tick failed`, error)),
		monitorIntervalMs,
	);
	monitorHandle.unref?.();

	monitorTick().catch((error) => logger.log(`ERROR`, `Initial queue health check failed`, error));

	return monitorHandle;
}

function stopHealthMonitor() {
	if (!monitorHandle) return;
	clearInterval(monitorHandle);
	monitorHandle = undefined;
	lastStateSnapshot = {
		redisHealthy: null,
		dbHealthy: null,
		combinesActive: null,
		healthy: null,
	};
}

module.exports = {
	startHealthMonitor,
	stopHealthMonitor,
};
