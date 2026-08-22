const crypto = require(`crypto`);
const { getRedisClient, runLua } = require(`../core/redis`);
const { DETECT_STATE_TTL_SECONDS } = require(`./submitDetect`);

const LOCK_TTL_MS = DETECT_STATE_TTL_SECONDS * 1000;

function matchSubmitLockKey(matchID) {
	return `submitlock:${matchID}`;
}

function parseTeamName(rawValue) {
	try {
		return JSON.parse(rawValue).teamName ?? null;
	} catch {
		return null;
	}
}

async function acquireMatchSubmitLock(matchID, { teamName, userId }) {
	const key = matchSubmitLockKey(matchID);
	const lockValue = JSON.stringify({ token: crypto.randomUUID(), teamName, userId });
	try {
		const redis = getRedisClient();
		const acquired = await redis.set(key, lockValue, `PX`, LOCK_TTL_MS, `NX`);
		if (acquired === `OK`) return { ok: true, lockValue };
		const currentValue = await redis.get(key);
		return { ok: false, heldByTeamName: currentValue ? parseTeamName(currentValue) : null };
	} catch (error) {
		logger.log(`WARNING`, `submitLock acquire failed for match ${matchID}; proceeding without lock`, error?.stack ?? error);
		return { ok: true, lockValue: null, degraded: true };
	}
}

async function releaseMatchSubmitLock(matchID, lockValue) {
	if (!lockValue) return;
	try {
		await runLua(`submitlock_release`, { keys: [matchSubmitLockKey(matchID)], args: [lockValue] });
	} catch (error) {
		logger.log(`WARNING`, `submitLock release failed for match ${matchID}`, error?.stack ?? error);
	}
}

module.exports = { matchSubmitLockKey, acquireMatchSubmitLock, releaseMatchSubmitLock };
