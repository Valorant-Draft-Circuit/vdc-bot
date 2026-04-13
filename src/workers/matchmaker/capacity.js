const { DEFAULT_CHANNEL_STOP_THRESHOLD } = require(`./constants`);

const CHANNEL_COUNT_REFRESH_MS = 30000;
const lastChannelRefreshAtByGuild = new Map();

async function ensureChannelCapacityForPops(client, config, controls) {
	const startedAt = Date.now();
	const threshold = Math.max(
		1,
		Number(config?.channelStopThreshold ?? DEFAULT_CHANNEL_STOP_THRESHOLD) || DEFAULT_CHANNEL_STOP_THRESHOLD,
	);

	let guild = null;
	const preferredGuildId = process.env.SERVER_ID ? String(process.env.SERVER_ID) : null;

	if (preferredGuildId) {
		guild =
			client.guilds.cache.get(preferredGuildId) ??
			(await client.guilds.fetch(preferredGuildId).catch(() => null));
	}

	if (!guild) {
		guild = client.guilds.cache.first() ?? null;
	}

	if (!guild) return true;

	const lastRefreshAt = lastChannelRefreshAtByGuild.get(guild.id) || 0;
	const shouldRefresh =
		guild.channels.cache.size === 0 ||
		Date.now() - lastRefreshAt >= CHANNEL_COUNT_REFRESH_MS;

	if (shouldRefresh) {
		await guild.channels.fetch().catch(() => null);
		lastChannelRefreshAtByGuild.set(guild.id, Date.now());
	}

	const currentChannelCount = guild.channels.cache.size;

	const elapsedMs = Date.now() - startedAt;
	if (elapsedMs >= 1500) {
		logger.log(`INFO`, `Channel capacity preflight took ${elapsedMs}ms (${currentChannelCount} channels cached)`);
	}

	if (currentChannelCount < threshold) return true;

	if (controls?.isRunning?.()) {
		const reason = `Channel capacity threshold reached (${currentChannelCount}/${threshold})`;
		controls.stopMatchmaker({ reason, source: `capacity` });
		logger.log(
			`ALERT`,
			`Queue matchmaker auto-stopped due to channel capacity (${currentChannelCount}/${threshold}) in guild ${guild.id}. Admin restart required once capacity is safe.`,
		);
	}

	return false;
}

module.exports = {
	ensureChannelCapacityForPops,
};
