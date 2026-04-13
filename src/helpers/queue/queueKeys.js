const QUEUE_BUCKETS = Object.freeze([`DE`, `FA`, `RFA`, `SIGNED`]);
const LEAGUE_STATE_KEY = `vdc:league_state`;
const TIERS_SET_KEY = `vdc:tiers`;
const QUEUE_CONFIG_CACHE_KEY = `vdc:config:queue`;
const EVENTS_STREAM_KEY = `vdc:events`;
const MATCH_KEY_PREFIX = `vdc:match:`;

function tierQueueKey(tier, bucket, options = {}) {
	const safeTier = String(tier);
	const safeBucket = String(bucket).toUpperCase();
	const suffix = options.completed ? `:completed` : ``;
	return `vdc:tier:${safeTier}:queue:${safeBucket}${suffix}`;
}

function tierQueueKeys(tier, options = {}) {
	const includeCompleted = options.includeCompleted !== false;
	const keys = QUEUE_BUCKETS.map((bucket) => tierQueueKey(tier, bucket));
	if (!includeCompleted) return keys;
	return keys.concat(QUEUE_BUCKETS.map((bucket) => tierQueueKey(tier, bucket, { completed: true })));
}

function tierOpenKey(tier) {
	return `vdc:tier:${String(tier)}:open`;
}

function playerKey(discordId) {
	return `vdc:player:${discordId}`;
}

function playerRecentKey(discordId) {
	return `${playerKey(discordId)}:recent`;
}

function matchKey(queueId) {
	return `${MATCH_KEY_PREFIX}${queueId}`;
}

function matchKeyPattern() {
	return `${MATCH_KEY_PREFIX}*`;
}

function queueIdFromMatchKey(key) {
	if (typeof key !== `string`) return null;
	if (!key.startsWith(MATCH_KEY_PREFIX)) return null;
	return key.slice(MATCH_KEY_PREFIX.length);
}

function scoutFollowersKey(playerId) {
	return `vdc:scouts:followers:${playerId}`;
}

function scoutFollowingKey(scoutId) {
	return `vdc:scouts:following:${scoutId}`;
}

module.exports = {
	QUEUE_BUCKETS,
	LEAGUE_STATE_KEY,
	TIERS_SET_KEY,
	QUEUE_CONFIG_CACHE_KEY,
	EVENTS_STREAM_KEY,
	MATCH_KEY_PREFIX,
	tierQueueKey,
	tierQueueKeys,
	tierOpenKey,
	playerKey,
	playerRecentKey,
	matchKey,
	matchKeyPattern,
	queueIdFromMatchKey,
	scoutFollowersKey,
	scoutFollowingKey,
};
