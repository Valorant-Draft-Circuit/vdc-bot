const { ChannelType, PermissionFlagsBits } = require(`discord.js`);
const { CHANNELS } = require(`../../../utils/enums/channels`);
const { ROLES } = require(`../../../utils/enums/roles`);

// keyed like the match embed's rosters: teamA is listed as Defenders and teamB as Attackers
const MATCH_CHANNEL_NAMES = Object.freeze({
	text: `match-chat`,
	teamA: `Defenders`,
	teamB: `Attackers`,
});

// Discord caps a category at 50 channels
const MAX_CHANNELS_PER_CATEGORY = 50;

function categoryHasRoom(guild, categoryId, channelsNeeded) {
	const category = categoryId ? guild.channels.cache.get(categoryId) : null;
	if (!category) return false;
	return (category.children?.cache?.size || 0) + channelsNeeded <= MAX_CHANNELS_PER_CATEGORY;
}

/**
 * Resolve the category ID for a match based on tier.
 * Returns the tier-specific category, or falls back to overflow.
 * Returns null if neither has room for the match's channels.
 *
 * @param {string} tier - The queue tier (MYTHIC, EXPERT, etc.)
 * @param {Guild} guild - Discord guild instance
 * @param {number} channelsNeeded - How many channels the match will add to the category
 * @returns {Promise<string|null>} The category snowflake ID, or null if unavailable
 */
async function resolveCategoryIdForTier(tier, guild, channelsNeeded = 3) {
	const tierCategoryId = tier ? CHANNELS.VC.COMBINES.COMBINE_CATEGORY[tier] : null;
	if (categoryHasRoom(guild, tierCategoryId, channelsNeeded)) return tierCategoryId;

	const overflowId = CHANNELS.VC.COMBINES.COMBINE_OVERFLOW;
	if (categoryHasRoom(guild, overflowId, channelsNeeded)) return overflowId;

	return null;
}

async function createMatchChannels(guild, options) {
	const {
		queueId,
		tier,
		allowedUserIds = [],
		staffRoleIds = [],
		reason = `Queue match ${queueId}`,
		enableVoice = true,
	} = options;

	const permissions = buildPermissionOverwrites(guild, allowedUserIds, staffRoleIds);

	const scoutRoleId = String(ROLES?.LEAGUE?.SCOUT || ``);
	if (
		isValidSnowflake(scoutRoleId) &&
		guild.roles.cache.has(scoutRoleId) &&
		!permissions.some((o) => String(o.id) === scoutRoleId)
	) {
		permissions.push({
			id: scoutRoleId,
			allow: [
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.Connect,
				PermissionFlagsBits.Speak,
				PermissionFlagsBits.UseVAD,
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.EmbedLinks,
				PermissionFlagsBits.AttachFiles,
				PermissionFlagsBits.AddReactions,
				PermissionFlagsBits.UseExternalEmojis,
				PermissionFlagsBits.UseExternalStickers,
				PermissionFlagsBits.ReadMessageHistory,
			],
		});
	}

	// Resolve the category ID (tier-based or overflow)
	const categoryId = await resolveCategoryIdForTier(tier, guild, enableVoice ? 3 : 1);
	if (!categoryId) {
		throw new Error(`No room for match channels for tier ${tier}; the tier category and overflow are full or missing`);
	}

	// Fetch the existing category (don't create a new one)
	const category = guild.channels.cache.get(categoryId);
	if (!category || category.type !== ChannelType.GuildCategory) {
		throw new Error(`Category ${categoryId} not found or is not a category`);
	}

	const created = [];
	try {
		const textChannel = await guild.channels.create({
			name: `${MATCH_CHANNEL_NAMES.text}${queueId ? `-${queueId}` : ``}`,
			type: ChannelType.GuildText,
			parent: category.id,
			reason,
			permissionOverwrites: permissions,
		});
		created.push(textChannel);

		let teamAChannel;
		let teamBChannel;

		if (enableVoice) {
			const voiceResults = await Promise.allSettled([
				guild.channels.create({
					name: `${MATCH_CHANNEL_NAMES.teamA}${queueId ? ` - ${queueId}` : ``}`,
					type: ChannelType.GuildVoice,
					parent: category.id,
					reason,
					permissionOverwrites: permissions,
				}),
				guild.channels.create({
					name: `${MATCH_CHANNEL_NAMES.teamB}${queueId ? ` - ${queueId}` : ``}`,
					type: ChannelType.GuildVoice,
					parent: category.id,
					reason,
					permissionOverwrites: permissions,
				}),
			]);
			for (const result of voiceResults) {
				if (result.status === `fulfilled`) created.push(result.value);
			}
			const failed = voiceResults.find((result) => result.status === `rejected`);
			if (failed) throw failed.reason;
			[teamAChannel, teamBChannel] = voiceResults.map((result) => result.value);
		}

		return {
			categoryId: category.id,
			textChannelId: textChannel.id,
			voiceChannelIds: {
				teamA: teamAChannel ? teamAChannel.id : null,
				teamB: teamBChannel ? teamBChannel.id : null,
			},
		};
	} catch (error) {
		// half a lobby is useless, and leaked channels count against the category for every later match
		await Promise.all(created.map((channel) => channel.delete(`Cleanup failed setup for match ${queueId}`).catch(() => null)));
		throw error;
	}
}

async function deleteMatchChannels(guild, descriptor) {
	const {
		textChannelId,
		voiceChannelIds = {},
		reason = `Removing queue match channels`,
	} = descriptor;

	const tasks = [];

	if (textChannelId) {
		const textChannel = guild.channels.cache.get(textChannelId);
		if (textChannel) tasks.push(textChannel.delete(reason).catch(() => null));
	}

	for (const channelId of Object.values(voiceChannelIds)) {
		if (!channelId) continue;
		const channel = guild.channels.cache.get(channelId);
		if (channel) tasks.push(channel.delete(reason).catch(() => null));
	}

	await Promise.all(tasks);
}

function buildPermissionOverwrites(guild, allowedUserIds, staffRoleIds) {
	const overwrites = [
		{
			id: guild.roles.everyone.id,
			deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect],
		},
	];

	if (Array.isArray(staffRoleIds)) {
		for (const roleId of staffRoleIds) {
			if (!roleId) continue;
			overwrites.push({
				id: roleId,
				allow: [
					PermissionFlagsBits.ViewChannel,
					PermissionFlagsBits.Connect,
					PermissionFlagsBits.Speak,
					PermissionFlagsBits.ManageChannels,
					PermissionFlagsBits.MoveMembers,
					PermissionFlagsBits.SendMessages,
				],
			});
		}
	}

	for (const userId of allowedUserIds) {
		if (!isValidSnowflake(userId)) continue;
		overwrites.push({
			id: userId,
			allow: [
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.Connect,
				PermissionFlagsBits.Speak,
				PermissionFlagsBits.UseVAD,
				PermissionFlagsBits.SendMessages,
				PermissionFlagsBits.EmbedLinks,
				PermissionFlagsBits.AttachFiles,
				PermissionFlagsBits.AddReactions,
				PermissionFlagsBits.UseExternalEmojis,
				PermissionFlagsBits.UseExternalStickers,
				PermissionFlagsBits.ReadMessageHistory,
			],
		});
	}

	return overwrites;
}

function isValidSnowflake(id) {
	return typeof id === `string` && /^\d{15,20}$/.test(id);
}

module.exports = {
	MATCH_CHANNEL_NAMES,
	createMatchChannels,
	deleteMatchChannels,
	resolveCategoryIdForTier,
};
