const { ChannelType, PermissionFlagsBits } = require(`discord.js`);
const { CHANNELS } = require(`../../../utils/enums/channels`);
const { ROLES } = require(`../../../utils/enums/roles`);

const MATCH_CHANNEL_NAMES = Object.freeze({
	text: `match-chat`,
	teamA: `Attackers`,
	teamB: `Defenders`,
});

/**
 * Resolve the category ID for a match based on tier.
 * Returns the tier-specific category, or falls back to overflow.
 * Returns null if neither is available.
 *
 * @param {string} tier - The queue tier (MYTHIC, EXPERT, etc.)
 * @param {Guild} guild - Discord guild instance
 * @returns {Promise<string|null>} The category snowflake ID, or null if unavailable
 */
async function resolveCategoryIdForTier(tier, guild) {
	if (!tier || !CHANNELS.VC.COMBINES.COMBINE_CATEGORY[tier]) {
		// Fall back to overflow for unknown tiers
		return CHANNELS.VC.COMBINES.COMBINE_OVERFLOW || null;
	}

	const tierCategoryId = CHANNELS.VC.COMBINES.COMBINE_CATEGORY[tier];

	// Check if tier category exists and has room for more channels
	const tierCategory = guild.channels.cache.get(tierCategoryId);
	if (!tierCategory) {
		// Tier category not found; fall back to overflow
		return CHANNELS.VC.COMBINES.COMBINE_OVERFLOW || null;
	}

	// Discord allows up to 50 channels per category
	// If tier category is full or near capacity, fall back to overflow
	const MAX_CHANNELS_PER_CATEGORY = 50;
	const catChildCount = tierCategory.children?.cache?.size || 0;
	if (catChildCount >= MAX_CHANNELS_PER_CATEGORY - 1) {
		// Category is full; use overflow
		return CHANNELS.VC.COMBINES.COMBINE_OVERFLOW || null;
	}

	return tierCategoryId;
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
	const categoryId = await resolveCategoryIdForTier(tier, guild);
	if (!categoryId) {
		throw new Error(`Cannot resolve category for tier ${tier}; no tier category or overflow available`);
	}

	// Fetch the existing category (don't create a new one)
	const category = guild.channels.cache.get(categoryId);
	if (!category || category.type !== ChannelType.GuildCategory) {
		throw new Error(`Category ${categoryId} not found or is not a category`);
	}

	const textChannel = await guild.channels.create({
		name: `${MATCH_CHANNEL_NAMES.text}${queueId ? `-${queueId}` : ``}`,
		type: ChannelType.GuildText,
		parent: category.id,
		reason,
		permissionOverwrites: permissions,
	});

	let teamAChannel;
	let teamBChannel;

	if (enableVoice) {
		[teamAChannel, teamBChannel] = await Promise.all([
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
	}

	return {
		categoryId: category.id,
		textChannelId: textChannel.id,
		voiceChannelIds: {
			teamA: teamAChannel ? teamAChannel.id : null,
			teamB: teamBChannel ? teamBChannel.id : null,
		},
	};
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
