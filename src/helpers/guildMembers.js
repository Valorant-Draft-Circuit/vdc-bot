// Discord rate limits full member list requests (gateway opcode 8) to one per guild every ~30s.
// The GuildMembers intent keeps the cache in sync after a full fetch, so reuse it for a few minutes
// instead of asking again, and share one in-flight request between concurrent callers.
const CACHE_REUSE_MS = 5 * 60 * 1000;

const lastFullFetch = new Map(); // guildId -> when the last full fetch finished
const inFlight = new Map(); // guildId -> pending full fetch

async function fetchAllMembers(guild) {
	const last = lastFullFetch.get(guild.id);
	if (last && Date.now() - last < CACHE_REUSE_MS) return guild.members.cache;

	if (!inFlight.has(guild.id)) {
		inFlight.set(guild.id, requestAllMembers(guild).finally(() => inFlight.delete(guild.id)));
	}
	return inFlight.get(guild.id);
}

async function requestAllMembers(guild) {
	try {
		await guild.members.fetch();
	} catch (err) {
		// window already used (e.g. right after a restart), wait it out and try once more
		if (err.name !== `GatewayRateLimitError`) throw err;
		await new Promise(resolve => setTimeout(resolve, Math.ceil(err.data.retry_after * 1000)));
		await guild.members.fetch();
	}
	lastFullFetch.set(guild.id, Date.now());
	return guild.members.cache;
}

module.exports = { fetchAllMembers };
