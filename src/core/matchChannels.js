const { ChannelType, PermissionFlagsBits } = require(`discord.js`);
const { getQueueConfig } = require(`./config`);

const MATCH_CHANNEL_NAMES = Object.freeze({
	text: `match-chat`,
	lobby: `Lobby`,
	teamA: `Attackers`,
	teamB: `Defenders`,
});

/**
 * Create the category, text channel, and voice channels for a match instance.
 * @param {import('discord.js').Guild} guild
 * @param {{
 *   queueId: string;
 *   tier: string;
 *   allowedUserIds?: string[];
 *   staffRoleIds?: string[];
 *   categoryName?: string;
 *   reason?: string;
 * }} options
 */
async function createMatchChannels(guild, options) {
	const {
		queueId,
		tier,
		allowedUserIds = [],
		staffRoleIds = [],
		categoryName = buildCategoryName(tier, queueId),
		reason = `Queue match ${queueId}`,
		enableVoice = true,
	} = options;

	const permissions = buildPermissionOverwrites(guild, allowedUserIds, staffRoleIds);

	// Attempt to read the configured scout role from the queue config (Redis / ControlPanel)
	// and add a permission overwrite for it if present. This replaces the previous
	// hardcoded scout role ID so non-prod servers don't break.
	try {
		const cfg = await getQueueConfig();
		const scoutRoleId = cfg && cfg.scoutRoleId ? String(cfg.scoutRoleId) : null;
		if (scoutRoleId && !permissions.some((o) => String(o.id) === scoutRoleId)) {
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
	} catch (error) {
		// If config read fails, fall back to existing permission set without scout role.
	}

	const category = await guild.channels.create({
		name: categoryName,
		type: ChannelType.GuildCategory,
		reason,
			permissionOverwrites: permissions,
		});

	const textChannel = await guild.channels.create({
		name: `${MATCH_CHANNEL_NAMES.text}${queueId ? `-${queueId}` : ``}`,
		type: ChannelType.GuildText,
		parent: category.id,
		reason,
		permissionOverwrites: permissions,
	});

	let lobbyChannel;
	let teamAChannel;
	let teamBChannel;

	if (enableVoice) {
		[lobbyChannel, teamAChannel, teamBChannel] = await Promise.all([
			guild.channels.create({
				name: `${MATCH_CHANNEL_NAMES.lobby}${queueId ? ` - ${queueId}` : ``}`,
				type: ChannelType.GuildVoice,
				parent: category.id,
				reason,
				permissionOverwrites: permissions,
			}),
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
			lobby: lobbyChannel ? lobbyChannel.id : null,
			teamA: teamAChannel ? teamAChannel.id : null,
			teamB: teamBChannel ? teamBChannel.id : null,
		},
	};
}

/**
 * Delete match channels when a match completes or is cancelled.
 * @param {import('discord.js').Guild} guild
 * @param {{
 *   categoryId?: string;
 *   textChannelId?: string;
 *   voiceChannelIds?: { lobby?: string; teamA?: string; teamB?: string };
 *   reason?: string;
 * }} descriptor
 */
async function deleteMatchChannels(guild, descriptor) {
	const {
		categoryId,
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

	if (categoryId) {
		const category = guild.channels.cache.get(categoryId);
		if (category) tasks.push(category.delete(reason).catch(() => null));
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

	// Scout role permission will be added at runtime from queue config (if configured).

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

function buildCategoryName(tier, queueId) {
	const tierLabel = tier ? tier.toUpperCase() : `COMBINES`;
	return `Match ${tierLabel} — ${queueId}`;
}

function isValidSnowflake(id) {
	return typeof id === `string` && /^\d{15,20}$/.test(id);
}

module.exports = {
	MATCH_CHANNEL_NAMES,
	createMatchChannels,
	deleteMatchChannels,
};
