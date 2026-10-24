const { metrics } = require(`@opentelemetry/api`);
const { enabled } = require(`../../core/telemetry`);
const { getRedisClient } = require(`../../core/redis`);
const { getMatchmakerStatus } = require(`../matchmaker`);
const {
	QUEUE_BUCKETS,
	TIERS_SET_KEY,
	EVENTS_STREAM_KEY,
	tierQueueKey,
	tierOpenKey,
	playerKey,
	matchKeyPattern,
} = require(`../../helpers/queue/queueKeys`);

// join.lua treats a missing tier flag as open, and these values as open
const OPEN_VALUES = new Set([`1`, `true`, `yes`, `open`, `enabled`]);

/**
 * Live queue, matchmaker and Valkey gauges for Grafana. Nothing runs on a timer: the SDK calls these
 * callbacks when it exports metrics (every 30s), so each export costs a few dozen cheap Redis reads.
 * Queue activity (joins, pops, wait times) is counted by the queue events instead (core/queue/events.js).
 */
function startMetrics() {
	if (!enabled) return;
	const meter = metrics.getMeter(`vdc-bot`);

	const queue = {
		players: meter.createObservableGauge(`vdc.queue.players`, { unit: `{player}`, description: `Players waiting, by tier, bucket and whether they've completed their required games` }),
		oldestWait: meter.createObservableGauge(`vdc.queue.oldest_wait`, { unit: `s`, description: `How long the longest-waiting player in each tier, bucket and list has been queued` }),
		activeMatches: meter.createObservableGauge(`vdc.queue.matches.active`, { unit: `{match}`, description: `Queue matches that haven't completed, by tier` }),
		tierOpen: meter.createObservableGauge(`vdc.queue.tier.open`, { description: `1 while the tier's queue is open` }),
		streamLength: meter.createObservableGauge(`vdc.queue.events_stream.length`, { unit: `{entry}`, description: `Entries in the legacy vdc:events stream, until it's retired` }),
	};
	meter.addBatchObservableCallback((observer) => observeQueue(observer, queue), Object.values(queue));

	const matchmaker = {
		running: meter.createObservableGauge(`vdc.matchmaker.running`, { description: `1 while the matchmaker loop is running` }),
		warmup: meter.createObservableGauge(`vdc.matchmaker.warmup`, { description: `1 during the matchmaker's warmup` }),
		ticks: meter.createObservableCounter(`vdc.matchmaker.ticks`, { description: `Matchmaker ticks that ran to completion` }),
	};
	meter.addBatchObservableCallback((observer) => {
		const status = getMatchmakerStatus();
		observer.observe(matchmaker.running, status.running ? 1 : 0);
		observer.observe(matchmaker.warmup, status.warmupActive ? 1 : 0);
		observer.observe(matchmaker.ticks, status.completedTicks);
	}, Object.values(matchmaker));

	// the same numbers as Valkey's INFO, named like the OpenTelemetry Redis receiver's
	const valkey = {
		memoryUsed: meter.createObservableGauge(`redis.memory.used`, { unit: `By` }),
		memoryRss: meter.createObservableGauge(`redis.memory.rss`, { unit: `By` }),
		memoryMax: meter.createObservableGauge(`redis.memory.max`, { unit: `By`, description: `maxmemory (0 = no limit); the policy is an attribute` }),
		clients: meter.createObservableGauge(`redis.clients.connected`, { unit: `{client}` }),
		blockedClients: meter.createObservableGauge(`redis.clients.blocked`, { unit: `{client}` }),
		commands: meter.createObservableCounter(`redis.commands.processed`, { unit: `{command}` }),
		evicted: meter.createObservableCounter(`redis.keys.evicted`, { unit: `{key}` }),
		expired: meter.createObservableCounter(`redis.keys.expired`, { unit: `{key}` }),
		hits: meter.createObservableCounter(`redis.keyspace.hits`, { unit: `{hit}` }),
		misses: meter.createObservableCounter(`redis.keyspace.misses`, { unit: `{miss}` }),
		keys: meter.createObservableGauge(`redis.db.keys`, { unit: `{key}` }),
		expiringKeys: meter.createObservableGauge(`redis.db.expires`, { unit: `{key}` }),
		uptime: meter.createObservableGauge(`redis.uptime`, { unit: `s` }),
	};
	meter.addBatchObservableCallback((observer) => observeValkey(observer, valkey), Object.values(valkey));

	logger.log(`INFO`, `Queue, matchmaker and Valkey metrics registered`);
}

async function observeQueue(observer, queue) {
	const redis = getRedisClient();
	const now = Date.now();
	const tiers = (await redis.smembers(TIERS_SET_KEY)).filter(Boolean);

	const lists = tiers.flatMap((tier) => QUEUE_BUCKETS.flatMap((bucket) => [false, true].map((completed) => ({ tier, bucket, completed }))));
	const listPipeline = redis.pipeline();
	for (const list of lists) listPipeline.lrange(tierQueueKey(list.tier, list.bucket, { completed: list.completed }), 0, -1);
	for (const tier of tiers) listPipeline.get(tierOpenKey(tier));
	const listResults = await listPipeline.exec();

	lists.forEach((list, i) => { list.ids = listResults[i][1] ?? []; });
	tiers.forEach((tier, i) => {
		const value = listResults[lists.length + i][1];
		observer.observe(queue.tierOpen, value == null || OPEN_VALUES.has(String(value).toLowerCase()) ? 1 : 0, { tier });
	});

	const ids = [...new Set(lists.flatMap((list) => list.ids))];
	const joinPipeline = redis.pipeline();
	for (const id of ids) joinPipeline.hget(playerKey(id), `queueJoinedAt`);
	const joinedAt = new Map((await joinPipeline.exec()).map(([, value], i) => [ids[i], Number(value) || now]));

	for (const { tier, bucket, completed, ids: listIds } of lists) {
		const attributes = { tier, bucket, completed };
		const oldest = listIds.length ? Math.min(...listIds.map((id) => joinedAt.get(id))) : now;
		observer.observe(queue.players, listIds.length, attributes);
		observer.observe(queue.oldestWait, Math.max(0, now - oldest) / 1000, attributes);
	}

	// the same count /queue status shows: match hashes whose status isn't completed
	const activeByTier = new Map(tiers.map((tier) => [tier, 0]));
	let cursor = `0`;
	do {
		const [next, keys] = await redis.scan(cursor, `MATCH`, matchKeyPattern(), `TYPE`, `hash`, `COUNT`, 250);
		cursor = next;
		if (keys.length) {
			const matchPipeline = redis.pipeline();
			for (const key of keys) matchPipeline.hmget(key, `tier`, `status`);
			for (const [, [tier, status] = []] of await matchPipeline.exec()) {
				if (tier && String(status ?? ``).toLowerCase() !== `completed`) activeByTier.set(tier, (activeByTier.get(tier) ?? 0) + 1);
			}
		}
	} while (cursor !== `0`);
	for (const [tier, count] of activeByTier) observer.observe(queue.activeMatches, count, { tier });

	observer.observe(queue.streamLength, Number(await redis.xlen(EVENTS_STREAM_KEY)) || 0);
}

async function observeValkey(observer, valkey) {
	const info = Object.fromEntries((await getRedisClient().info()).split(`\r\n`)
		.filter((line) => line && !line.startsWith(`#`))
		.map((line) => [line.slice(0, line.indexOf(`:`)), line.slice(line.indexOf(`:`) + 1)]));
	const number = (key) => Number(info[key]) || 0;

	observer.observe(valkey.memoryUsed, number(`used_memory`));
	observer.observe(valkey.memoryRss, number(`used_memory_rss`));
	observer.observe(valkey.memoryMax, number(`maxmemory`), { policy: info.maxmemory_policy ?? `unknown` });
	observer.observe(valkey.clients, number(`connected_clients`));
	observer.observe(valkey.blockedClients, number(`blocked_clients`));
	observer.observe(valkey.commands, number(`total_commands_processed`));
	observer.observe(valkey.evicted, number(`evicted_keys`));
	observer.observe(valkey.expired, number(`expired_keys`));
	observer.observe(valkey.hits, number(`keyspace_hits`));
	observer.observe(valkey.misses, number(`keyspace_misses`));
	observer.observe(valkey.uptime, number(`uptime_in_seconds`));

	// keyspace lines look like db0:keys=123,expires=4,avg_ttl=0
	for (const [db, value] of Object.entries(info).filter(([key]) => /^db\d+$/.test(key))) {
		const fields = Object.fromEntries(value.split(`,`).map((pair) => pair.split(`=`)));
		observer.observe(valkey.keys, Number(fields.keys) || 0, { db });
		observer.observe(valkey.expiringKeys, Number(fields.expires) || 0, { db });
	}
}

module.exports = { startMetrics };
