const { getRedisClient } = require(`../../core/redis`);
const { createMatchChannels, deleteMatchChannels } = require(`../../core/queue/matchChannels`);
const { scoutFollowersKey, matchKey } = require(`../../helpers/queue/queueKeys`);
const { CHANNELS } = require(`../../../utils/enums/channels`);
const { getRandomMapInfo } = require(`./maps`);
const { buildMatchEmbed, buildPriorityEmbed } = require(`./embeds`);
const { buildMatchComponents } = require(`./components`);
const { notifyPlayersDirectly, mapWithConcurrency } = require(`./notifications`);

async function dispatchMatch(client, payload, config) {
	let guild = null;

	const candidateGuildId = payload.guildId || payload.players.find((p) => p.guildId)?.guildId;

	if (candidateGuildId) {
		guild =
			client.guilds.cache.get(candidateGuildId) ??
			(await client.guilds.fetch(candidateGuildId).catch(() => null));
	}

	if (!guild) {
		logger.log(`WARNING`, `Match ${payload.queueId} could not resolve a guild context`);
		return;
	}

	const playerIds = (Array.isArray(payload.players) ? payload.players : []).map((p) => p.id).filter(Boolean);
	const redis = getRedisClient();

	const scoutsSet = await collectScoutFollowers(redis, payload.players || []);

	let channelDescriptor = {
		categoryId: null,
		textChannelId: null,
		voiceChannelIds: {},
	};

	try {
		const allowedUserIds = [...playerIds, ...scoutsSet];
		channelDescriptor = await createMatchChannels(guild, {
			queueId: payload.queueId,
			tier: payload.tier,
			allowedUserIds,
			staffRoleIds: [],
			enableVoice: true,
		});
	} catch (error) {
		logger.log(`ERROR`, `Failed to create match channels`, error);
	}

	if (!channelDescriptor.textChannelId) {
		logger.log(`WARNING`, `Match ${payload.queueId} has no text channel target`);
		return;
	}

	const textChannel = await guild.channels.fetch(channelDescriptor.textChannelId).catch(() => null);
	if (!textChannel) {
		logger.log(`ERROR`, `No text channel available to post match ${payload.queueId}`);
		await cleanupCreatedChannels(guild, channelDescriptor, payload.queueId);
		return;
	}

	const mapInfo = await getRandomMapInfo(config);
	const embed = buildMatchEmbed(payload, mapInfo, Boolean(config?.displayMmr));
	const priorityEmbed = buildPriorityEmbed(payload);
	const embedData = embed.toJSON();
	const components = buildMatchComponents(payload.queueId);
	const mentionLine = playerIds.map((id) => `<@${id}>`).join(` `);

	let sentMessage;
	try {
		sentMessage = await textChannel.send({
			content: mentionLine,
			embeds: [embed],
			components,
		});
		await sentMessage.pin().catch(() => null);
	} catch (error) {
		logger.log(`ERROR`, `Failed to send initial match post for ${payload.queueId}`, error);
		await cleanupCreatedChannels(guild, channelDescriptor, payload.queueId);
		return;
	}

	await updateMatchChannelsInRedis(payload.queueId, channelDescriptor);

	await textChannel.send({ embeds: [priorityEmbed] }).catch((error) => {
		logger.log(`WARNING`, `Failed to send lock-order embed for ${payload.queueId}`, error);
	});

	await notifyPlayersDirectly(
		client,
		payload,
		embedData,
		channelDescriptor.textChannelId,
		guild,
		Array.from(scoutsSet),
	);

	const scoutAlertChannelId = CHANNELS?.SCOUT_ALERT_CHANNEL ? String(CHANNELS.SCOUT_ALERT_CHANNEL) : null;
	if (scoutAlertChannelId) {
		const scoutChannel = await guild.channels.fetch(scoutAlertChannelId).catch(() => null);
		if (scoutChannel) {
			await scoutChannel
				.send({
					content: `A new match has been started in <#${channelDescriptor.textChannelId}>`,
					embeds: [embed],
				})
				.catch((error) => logger.log(`WARNING`, `Failed to send scout channel post`, error));
		}
	}
}

async function collectScoutFollowers(redis, players) {
	const scoutsSet = new Set();
	const ids = (Array.isArray(players) ? players : []).map((p) => p?.id).filter(Boolean);

	await mapWithConcurrency(ids, 5, async (playerId) => {
		try {
			const followers = await redis.smembers(scoutFollowersKey(playerId));
			if (Array.isArray(followers)) {
				for (const scoutId of followers) scoutsSet.add(scoutId);
			}
		} catch (error) {
			// best-effort follower lookup
		}
	});

	return scoutsSet;
}

async function updateMatchChannelsInRedis(queueId, descriptor) {
	const redis = getRedisClient();
	const key = matchKey(queueId);
	await redis.hset(key, `channelIdsJSON`, JSON.stringify(descriptor));
	await redis.hset(key, `status`, `active`);
}

async function cleanupCreatedChannels(guild, channelDescriptor, queueId) {
	if (!channelDescriptor || !channelDescriptor.textChannelId) return;
	await deleteMatchChannels(guild, {
		...channelDescriptor,
		reason: `Cleanup failed dispatch for match ${queueId}`,
	}).catch((error) => logger.log(`WARNING`, `Failed to cleanup channels for ${queueId}`, error));
}

module.exports = {
	dispatchMatch,
};
