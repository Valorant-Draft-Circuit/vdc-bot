const { getRedisClient } = require(`../redis`);
const { setTierState } = require(`../../interactions/subcommands/queue/admin`);
const { TIERS_SET_KEY } = require(`../../helpers/queue/queueKeys`);

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const AUTO_CLOSE_HOUR_UTC = 8;

let startupTimeoutHandle;
let recurringIntervalHandle;

function msUntilNextHourUtc(targetHour) {
	const now = new Date();
	const next = new Date(now.toISOString());
	next.setUTCHours(targetHour, 0, 0, 0);
	if (next.getTime() <= now.getTime()) {
		next.setUTCDate(next.getUTCDate() + 1);
	}
	return next.getTime() - now.getTime();
}

async function closeAllTiersJob() {
	try {
		const redis = getRedisClient();
		const tiers = await redis.smembers(TIERS_SET_KEY);
		if (!Array.isArray(tiers) || tiers.length === 0) return;
		await setTierState(tiers, false);
		logger.log(`INFO`, `Auto-closed all queues at 08:00 UTC`);
	} catch (error) {
		logger.log(`ERROR`, `Failed to auto-close queues`, error);
	}
}

function startQueueAutoCloseJob() {
	if (startupTimeoutHandle || recurringIntervalHandle) {
		return {
			startupTimeoutHandle,
			recurringIntervalHandle,
		};
	}

	const initialDelay = msUntilNextHourUtc(AUTO_CLOSE_HOUR_UTC);
	startupTimeoutHandle = setTimeout(() => {
		closeAllTiersJob();
		recurringIntervalHandle = setInterval(closeAllTiersJob, DAILY_INTERVAL_MS);
		recurringIntervalHandle.unref?.();
	}, initialDelay);
	startupTimeoutHandle.unref?.();

	return {
		startupTimeoutHandle,
		recurringIntervalHandle,
	};
}

module.exports = {
	startQueueAutoCloseJob,
	closeAllTiersJob,
	msUntilNextHourUtc,
};
