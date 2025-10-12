const { ChannelType, PermissionFlagsBits } = require(`discord.js`);

const MATCH_CHANNEL_NAMES = Object.freeze({
	text: `match-chat`,
	lobby: `Lobby`,
	teamA: `Team A`,
	teamB: `Team B`,
});

function log(level, message, error) {
	if (global.logger && typeof global.logger.log === `function`) {
		global.logger.log(level, message, error);
	} else if (error) {
		console.log(`[${level}] ${message} :: ${error.message || error}`);
	} else {
		console.log(`[${level}] ${message}`);
	}
}

/**
 * Create the category, text channel, and voice channels for a match instance.
 * @param {import('discord.js').Guild} guild
 * @param {{
 *   matchId: string;
 *   tier: string;
 *   allowedUserIds?: string[];
 *   staffRoleIds?: string[];
 *   categoryName?: string;
 *   reason?: string;
 * }} options
 */
async function createMatchChannels(guild, options) {
	const {
		matchId,
		tier,
		allowedUserIds = [],
		staffRoleIds = [],
		categoryName = buildCategoryName(tier, matchId),
		reason = `Queue match ${matchId}`,
		enableVoice = true,
	} = options;

	const permissions = buildPermissionOverwrites(guild, allowedUserIds, staffRoleIds);

	const category = await guild.channels.create({
		name: categoryName,
		type: ChannelType.GuildCategory,
		reason,
			permissionOverwrites: permissions,
		});

	const textChannel = await guild.channels.create({
		name: MATCH_CHANNEL_NAMES.text,
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
				name: MATCH_CHANNEL_NAMES.lobby,
				type: ChannelType.GuildVoice,
				parent: category.id,
				reason,
				permissionOverwrites: permissions,
			}),
			guild.channels.create({
				name: MATCH_CHANNEL_NAMES.teamA,
				type: ChannelType.GuildVoice,
				parent: category.id,
				reason,
				permissionOverwrites: permissions,
			}),
			guild.channels.create({
				name: MATCH_CHANNEL_NAMES.teamB,
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

	for (const userId of allowedUserIds) {
		if (!isValidSnowflake(userId)) continue;
		overwrites.push({
			id: userId,
			allow: [
				PermissionFlagsBits.ViewChannel,
				PermissionFlagsBits.Connect,
				PermissionFlagsBits.Speak,
				PermissionFlagsBits.SendMessages,
			],
		});
	}

	return overwrites;
}

function buildCategoryName(tier, matchId) {
	const tierLabel = tier ? tier.toUpperCase() : `COMBINES`;
	return `Match ${tierLabel} — ${matchId}`;
}

function isValidSnowflake(id) {
	return typeof id === `string` && /^\d{15,20}$/.test(id);
}

module.exports = {
	MATCH_CHANNEL_NAMES,
	createMatchChannels,
	deleteMatchChannels,
};
