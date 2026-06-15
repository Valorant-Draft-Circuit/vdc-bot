/**
 * In-memory registry of pending auto-unsub timers, keyed by the player's
 * internal database id. When a player is subbed in, sub.js arms a timer that
 * will unsub them after the active sub window elapses. If that player is
 * officially signed or cut before the window ends, the owning command cancels
 * the timer here so a stale auto-unsub can't drop them from their roster.
 *
 * Note: these timers live only in this process, so a bot restart still loses
 * any pending auto-unsub. Persisting sub expiry across restarts is tracked
 * separately.
 */

const pendingUnsubTimers = new Map();

function registerUnsubTimer(playerID, timerHandle) {
	cancelUnsubTimer(playerID);
	pendingUnsubTimers.set(playerID, timerHandle);
}

function cancelUnsubTimer(playerID) {
	const existingTimer = pendingUnsubTimers.get(playerID);
	if (existingTimer === undefined) return;

	clearTimeout(existingTimer);
	pendingUnsubTimers.delete(playerID);
}

function clearUnsubTimer(playerID) {
	pendingUnsubTimers.delete(playerID);
}

module.exports = {
	registerUnsubTimer: registerUnsubTimer,
	cancelUnsubTimer: cancelUnsubTimer,
	clearUnsubTimer: clearUnsubTimer,
};
