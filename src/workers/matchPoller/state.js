const { getRedisClient } = require(`../../core/redis`);
const { STATE_TTL_SECONDS } = require(`./config`);

/** Per-match poller markers in Redis so the worker's one-shot actions survive restarts and never
 * repeat across ticks:
 *  - pinged: the home GM has been DM'd about this match (an anomaly or a give-up); don't DM again.
 *  - submitted: the poller auto-submitted at least one game; on completion this means the poller
 *    finished the series (send the success notifications) rather than a manual /submit doing it.
 *  - done: the poller has finalized this match and should skip it from here on.
 * All markers self-expire well after the match's poll window (see STATE_TTL_SECONDS). */

const KEYS = {
	pinged: (matchID) => `matchpoller:pinged:${matchID}`,
	submitted: (matchID) => `matchpoller:submitted:${matchID}`,
	done: (matchID) => `matchpoller:done:${matchID}`,
};

async function mark(key) {
	await getRedisClient().set(key, `1`, `EX`, STATE_TTL_SECONDS);
}

async function has(key) {
	return (await getRedisClient().get(key)) !== null;
}

const markPinged = (matchID) => mark(KEYS.pinged(matchID));
const wasPinged = (matchID) => has(KEYS.pinged(matchID));

const markSubmitted = (matchID) => mark(KEYS.submitted(matchID));
const wasSubmitted = (matchID) => has(KEYS.submitted(matchID));

const markDone = (matchID) => mark(KEYS.done(matchID));
const wasDone = (matchID) => has(KEYS.done(matchID));

module.exports = {
	markPinged,
	wasPinged,
	markSubmitted,
	wasSubmitted,
	markDone,
	wasDone,
};
