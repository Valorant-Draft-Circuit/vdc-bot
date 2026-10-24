const { metrics } = require(`@opentelemetry/api`);
const { emitEvent } = require(`../telemetry`);

// Queue events: one record per queue action, searchable in Grafana (Loki, vdc_event="queue_join" and so on,
// by player, match or tier) and counted in the queue metrics. These replace the vdc:events Redis stream,
// which nothing reads, nothing trims, and which misses kills, admin actions and rejected joins. The stream is
// still written alongside them until it's retired.

const meter = metrics.getMeter(`vdc-bot`);
const eventCounter = meter.createCounter(`vdc.queue.events`, { description: `Queue events, by event and tier` });
const waitHistogram = meter.createHistogram(`vdc.queue.wait`, {
	unit: `s`,
	description: `How long each player in a popped match had been waiting`,
	advice: { explicitBucketBoundaries: [30, 60, 120, 300, 600, 900, 1200, 1800, 2700, 3600, 5400, 7200] },
});

// the player an event is about uses the same attribute as interaction spans, so one search finds both
const ATTRIBUTE_NAMES = { userId: `discord.user.id`, queueId: `vdc.queue.id`, tier: `vdc.queue.tier` };

/**
 * Record a queue event.
 * @param {String} type e.g. `queue_join`, `match_created`, `match_killed`
 * @param {Object} fields what it's about: `tier`, `queueId`, `userId` (the player), `by` (who did it: a
 *                        player ID, an admin label or `system`), plus anything worth searching on. Arrays are
 *                        joined with commas; empty values are dropped.
 */
function queueEvent(type, fields = {}) {
	const attributes = {};
	for (const [key, value] of Object.entries(fields)) {
		if (value === undefined || value === null || value === ``) continue;
		const name = ATTRIBUTE_NAMES[key] ?? `vdc.queue.${key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}`;
		attributes[name] = Array.isArray(value) ? value.join(`,`) : value;
	}

	const summary = [type, fields.tier, fields.queueId && `match ${fields.queueId}`, fields.userId && `player ${fields.userId}`].filter(Boolean).join(` `);
	emitEvent(type, summary, attributes);
	eventCounter.add(1, { event: type, tier: String(fields.tier ?? ``) });
}

/**
 * A match popped (build_match's result): the event, plus every player's wait in the wait-time histogram.
 * @param {{ queueId: String, tier: String, relaxed: Boolean, players: { id: String, bucket: String, waitMs: Number, completed: Boolean }[] }} payload
 */
function recordMatchCreated(payload) {
	const players = Array.isArray(payload.players) ? payload.players : [];
	const waits = players.map((player) => Math.max(0, Number(player.waitMs) || 0));

	players.forEach((player, i) => {
		waitHistogram.record(waits[i] / 1000, { tier: String(payload.tier), bucket: String(player.bucket ?? `?`), completed: Boolean(player.completed) });
	});

	queueEvent(`match_created`, {
		tier: payload.tier,
		queueId: payload.queueId,
		relaxed: Boolean(payload.relaxed),
		players: players.map((player) => player.id),
		longestWaitSeconds: waits.length ? Math.round(Math.max(...waits) / 1000) : 0,
	});
}

module.exports = { queueEvent, recordMatchCreated };
