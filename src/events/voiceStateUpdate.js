// const lobby = ; // ID for "new vc" button
const channelNames = [
	// pistols
	`Classic`, `Shorty`, `Frenzy`, `Ghost`, `Sheriff`,

	// smgs
	`Stinger`, `Spectre`,

	// shotguns
	`Bucky`, `Judge`,

	// rifles
	`Bulldog`, `Guardian`, `Phantom`, `Vandal`,

	// snipers
	`Marshal`, `Outlaw`, `Operator`,

	// machine guns
	`Ares`, `Odin`,
];

const { ChannelType, BaseClient, VoiceState, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder } = require(`discord.js`);
const { CHANNELS, GUILD, ROLES } = require(`../../utils/enums`);
const fs = require(`fs`);
const { LeagueStatus } = require("@prisma/client");

// 382893405178691584

const refreshRequire = async (path) => {
	delete require.cache[require.resolve(path)];
	return await require(path);
}

const allowedLeagueStatuses = [
	LeagueStatus.DRAFT_ELIGIBLE,
	LeagueStatus.FREE_AGENT,
	LeagueStatus.GENERAL_MANAGER,
	LeagueStatus.RESTRICTED_FREE_AGENT,
	LeagueStatus.SIGNED
];


module.exports = {

	/**
	 * Emitted whenever a member changes voice state - e.g. joins/leaves a channel, mutes/unmutes.
	 * @type {Event}
	 * @references
	 * @djs https://discord.js.org/#/docs/discord.js/main/class/Client?scrollTo=e-voiceStateUpdate
	 * @api https://discord.com/developers/docs/topics/gateway-events#voice-state-update
	 */

	name: `voiceStateUpdate`,
	once: false,


	async execute(
		/** @type BaseClient */ client,
		/** @type VoiceState */ oldState,
		/** @type VoiceState */ newState
	) {
		// if (oldState.guild.id !== GUILD) return;
		// if (!Boolean(Number(process.env.PROD))) return;

		/** Standard Join/Leave Button (The Range) */
		/* ########################################################################### */
		const joinedLobbyBool = newState.channelId === CHANNELS.VC.LOBBY;
		const leftVCBool = channelNames.includes(oldState.channel?.name);
		const leftChannelMemberCount = oldState.channel?.members.map(m => m).length;

		if (leftVCBool && joinedLobbyBool && leftChannelMemberCount === 0) {
			await voiceDelete(client, oldState);
			return await voiceCreate(client, oldState, newState);
		};
		if (joinedLobbyBool) {
			return voiceCreate(client, oldState, newState);
		};
		if (leftVCBool && leftChannelMemberCount === 0) {
			return voiceDelete(client, oldState);
		};
		/* ########################################################################### */



		/** Combines VC Sorting */
		/* ########################################################################### */
		const sortChannel = CHANNELS.VC.COMBINES.SORT_CHANNEL
		const joinedCombinesLobbyBool = newState?.channelId === sortChannel;

		const tierCategories = Object.values(CHANNELS.VC.COMBINES.COMBINE_CATEGORY);
		const isInCombinesCategory = tierCategories.includes(newState?.channel?.parent?.id);

		const isScout = newState.member.roles.cache.map(r => r.id).includes(ROLES.OPERATIONS.SCOUT);

		const isAdmin = newState.member.roles.cache.map(r => r.id).includes(ROLES.OPERATIONS.ADMIN);
		const isMod = newState.member.roles.cache.map(r => r.id).includes(ROLES.OPERATIONS.MOD);

		// if a player joines the combines lobby, verify valid MMR and then move them to the correct channel
		if (joinedCombinesLobbyBool) {
			newState.channel.members.map(async (m) => {

				// import the mmr caches
				const mmrCache = await refreshRequire(`../../cache/mmrCache`);
				const tierLines = await refreshRequire(`../../cache/mmrTierLinesCache`);

				const mmr = Number(mmrCache.find(mmr => mmr.discordID === m.id)?.mmr);
				const playerTier = getTier(mmr, tierLines);

				// check if the player has a valid MMR/tier and isn't an admin or mod
				if (playerTier == undefined && !isAdmin && !isMod) {

					m.voice.disconnect();
					dmJoinFailureReason(m,
						`There is a problem with your account (invalid MMR) and you cannot join <#${CHANNELS.VC.COMBINES.SORT_CHANNEL}> currently. Please open an admin ticket.`,
						`Sent ${m} (${m.user.username}) a DM with an error message for having an invalid MMR`
					);
					return logger.log(`ALERT`, `User ${m.user} (${m.user.username}) joined <#${sortChannel}> with an invalid MMR (\`${mmr}\`) & has been disconnected`);

				} else if (playerTier == undefined && (isAdmin || isMod)) {

					// not a valid tier but is an admin/mod
					m.voice.disconnect();
					dmJoinFailureReason(m,
						`Even though you are an admin/mod, you have an invalid MMR and cannot join <#${CHANNELS.VC.COMBINES.SORT_CHANNEL}>. Please join the waiting rooms directly.`,
						`Sent ${m} (${m.user.username}) a DM with an error message for having an invalid mmr. Even though they are a mod/admin, they cannot be sorted`
					);
					return logger.log(`ALERT`, `User ${m.user} (${m.user.username}) joined <#${sortChannel}> with an invalid tier (\`${playerTier}\`) & has been disconnected. Even though they are a mod/admin, they cannot be sorted`);
				} else {
					const playerLeagueStatus = mmrCache.find(mmr => mmr.discordID === m.id)?.ls;
					const isValidStatus = allowedLeagueStatuses.includes(playerLeagueStatus);

					// check if the player has a valid status
					if (!isValidStatus && !isAdmin && !isMod) {
						m.voice.disconnect();
						dmJoinFailureReason(m,
							`There is a problem with your account (invalid status, \`${playerLeagueStatus}\`) and you cannot join <#${CHANNELS.VC.COMBINES.SORT_CHANNEL}> currently. Please open an admin ticket.`,
							`Sent ${m} (${m.user.username}) a DM with an error message for having an invalid status`
						);
						return logger.log(`ALERT`, `User ${m.user} (${m.user.username}) joined <#${sortChannel}> with an invalid leagueStatus (\`${playerLeagueStatus}\`) & has been disconnected. Even though they are a mod/admin, they cannot be sorted`);

					} else if (!isValidStatus && (isAdmin || isMod)) {
						// not a valid status but is an admin/mod
						m.voice.disconnect();
						dmJoinFailureReason(m,
							`Even though you are an admin/mod, you have an invalid status (\`${playerLeagueStatus}\`) and cannot join <#${CHANNELS.VC.COMBINES.SORT_CHANNEL}> Please join the calls directly.`,
							`Sent ${m} (${m.user.username}) a DM with an error message for having an invalid status. Even if they are a mod/admin, they cannot be sorted`
						);
						return logger.log(`ALERT`, `User ${m.user} (${m.user.username}) joined <#${sortChannel}> with an invalid leagueStatus (\`${playerLeagueStatus}\`) & has been disconnected. Even though they are a mod/admin, they cannot be sorted`);
					} else {

						const channel = CHANNELS.VC.COMBINES.WAITING_ROOM[playerTier];

						m.voice.setChannel(channel);
						return logger.log(`INFO`, `User ${m.user} (${m.user.username}) joined <#${sortChannel}> with an MMR of \`${mmr}\` & has been moved to <#${channel}>`);

					}
				}
			});
		}

		// if the player joins a channel in the commbines category, confirm that they are a scout or a player with a valid MMR
		if (isInCombinesCategory) {
			newState.channel.members.map(async (m) => {

				// import the mmr caches
				const mmrCache = await refreshRequire(`../../cache/mmrCache`);
				const tierLines = await refreshRequire(`../../cache/mmrTierLinesCache`);

				const mmr = Number(mmrCache.find(mmr => mmr.discordID === m.id)?.mmr);
				const playerTier = getTier(mmr, tierLines);
				const isInCorrectTier = playerTier === m.voice.channel.parent.name.toUpperCase().replace(`COMBINES - `, ``);

				const playerLeagueStatus = mmrCache.find(mmr => mmr.discordID === m.id)?.ls;
				const isValidStatus = allowedLeagueStatuses.includes(playerLeagueStatus);

				if (isScout) {		// if they player is a scout
					if (playerTier == undefined) {
						// player has no tier (non-playing FM/scout)
						return logger.log(`INFO`, `User ${newState.member} (${newState.member.user.username}) is joining ${m.voice.channel} (${m.voice.channel.name}) as a scout. They **DO NOT** have a valid MMR and **SHOULD NOT BE** playing`);

					} else if (playerTier !== undefined && !isInCorrectTier) { 					// valid tier, not correct tier
						// else if the player is a scout for a tier they are not playing in
						return logger.log(`INFO`, `User ${newState.member} (${newState.member.user.username}) is joining ${m.voice.channel} (${m.voice.channel.name}) as a scout. Their tier (${playerTier}) **DOES NOT MATCH** the channel they are in and they **SHOULD NOT BE** playing`);

					} else if (playerTier !== undefined && isInCorrectTier && !isValidStatus) { // valid tier, correct tier, not correct status
						// else if the player is a scout with an invalid status
						return logger.log(`INFO`, `User ${newState.member} (${newState.member.user.username}) is joining ${m.voice.channel} (${m.voice.channel.name}) as a scout. They have an **INVALID STATUS** (\`${playerLeagueStatus}\`) and they **SHOULD NOT BE** playing`);

					} else {																	// valid tier, correct tier, valid status
						// user is either a player with a valid MMR or a scout
						return logger.log(`INFO`, `User ${newState.member} (${newState.member.user.username}) is joining ${m.voice.channel} (${m.voice.channel.name}) as either a scout OR a player with an MMR of \`${mmr}\` & leagueStatus of \`${playerLeagueStatus}\``);
					}

				} else {			// if the player is NOT a scout

					if (!isInCorrectTier && !isAdmin && !isMod) {
						// not a scout and in the incorrect tier
						const channelObject = m.voice.channel;


						if (playerTier == undefined) { 				// tier is undefined (invalid mmr)
							m.voice.disconnect();
							dmJoinFailureReason(m,
								`You joined (${channelObject}, \`${channelObject.name}\`) but do not have a valid mmr. If you believe this is an error, please open an admin ticket`,
								`Sent ${m} (${m.user.username}) a DM with an error message for joining a tier channel without a valid mmr`
							);
							return logger.log(`INFO`, `User ${m.user} (${m.user.username}) joined ${channelObject} (\`${channelObject.name}\`) with an invalid mmr. They have been disconnected`);
						} else {							// tier is defined (valid mmr)
							m.voice.disconnect();
							dmJoinFailureReason(m,
								`You joined the wrong tier channel (${channelObject}, \`${channelObject.name}\`)- I expected to see you in a(n) \`${playerTier}\` voice channel. Please join <#${CHANNELS.VC.COMBINES.SORT_CHANNEL}> and wait to be sorted. If you believe this is an error, please open an admin ticket`,
								`Sent ${m} (${m.user.username}) a DM with an error message for joining the wrong tier channel`
							);
							return logger.log(`INFO`, `User ${m.user} (${m.user.username}) joined the wrong tier channel (${channelObject}) with an MMR of \`${mmr}\` - expected to see them in \`${playerTier}\`. They have been disconnected`);
						}


					} else if (!isInCorrectTier && (isAdmin || isMod)) {
						// not a scout and in the incorrect tier but is an admin/mod
						return logger.log(`INFO`, `User ${m.user} (${m.user.username}) joined the wrong tier channel (${m.voice.channel}) with an MMR of \`${mmr}\` - but they are an admin/mod so they have not been disconnected`);

					} else if (isInCorrectTier && !isValidStatus && (isAdmin || isMod)) {
						// not a scout and in the correct tier, has invalid status but is an admin/mod
						return logger.log(`INFO`, `User ${m.user} (${m.user.username}) joined ${m.voice.channel} with an invalid leagueStatus (\`${playerLeagueStatus}\`) - but they are an admin/mod so they have not been disconnected`);

					} else {
						// not a scout and in the correct tier
						if (isValidStatus) { 			// has valid status
							return logger.log(`INFO`, `User ${m.user} (${m.user.username}) joined ${m.voice.channel} (${m.voice.channel.name}) with an MMR of \`${mmr}\` & leagueStatus of \`${playerLeagueStatus}\``);
						} else {						// has invalid status
							m.voice.disconnect();
							dmJoinFailureReason(m,
								`There is a problem with your account (invalid status, \`${playerLeagueStatus}\`) and you cannot join <#${CHANNELS.VC.COMBINES.SORT_CHANNEL}> currently. Please open an admin ticket.`,
								`Sent ${m} (${m.user.username}) a DM with an error message for having an invalid status`
							);
							return logger.log(`ALERT`, `User ${m.user} (${m.user.username}) joined <#${sortChannel}> with an invalid leagueStatus (\`${playerLeagueStatus}\`) & has been disconnected`);
						}
					}
				}
			});
		}
		/* ########################################################################### */
	}
};



async function voiceCreate(
	/** @type BaseClient */ client,
	/** @type VoiceState */ oldState,
	/** @type VoiceState */ newState
) {

	const currentlyUsedChannels = (await client.guilds.cache.get(GUILD)).channels.cache
		.filter(c => channelNames.includes(c.name) && c.id !== CHANNELS.VC.LOBBY)
		.map(c => c.name);

	const availableChannelNames = channelNames.filter(c => !currentlyUsedChannels.includes(c));
	if (availableChannelNames.length === 0) return logger.log(`WARNING`, `No more channel options remaining`);

	const randIndex = Math.floor(Math.random() * availableChannelNames.length);
	const newChannelName = availableChannelNames[randIndex];

	const newVoiceChannel = (await newState.guild.channels.create({
		name: newChannelName,
		type: ChannelType.GuildVoice,
		parent: newState.channel.parentId,
		position: newState.channel.rawPosition + 1,
		bitrate: 64000,
	}));

	logger.log(`INFO`, `${newVoiceChannel.name} was created`);

	newState.channel.members.map(m => {
		m.voice.setChannel(newVoiceChannel.id);
		username = m.user.username;

		logger.log(`INFO`, `${m.user.username} was moved to ${newVoiceChannel.name}`);
	});

	// send the channel settings in the voice channel
	const embed = new EmbedBuilder({
		title: `Welcome to the ${newChannelName}`,
		description:
			`You can use the buttons below to edit settings for your voice channel!\n\n` +
			`🔐 - locks the channel. Members can see the channel but not join.\n` +
			`👥 - hides the channel. Members cannot see or join the channel.\n\n` +
			`-# Note: These channel settings can be changed by any members currently in the voice channel.`,
		color: 0x235A81
	});

	const memberLimitRole = new ActionRowBuilder({
		components: [new StringSelectMenuBuilder({
			customId: `toggleMembers`,
			placeholder: `Modify Channel Member Limits`,
			options: [
				{ label: `Open`, value: `0` },
				{ label: `Duos`, value: `2` },
				{ label: `Trios`, value: `3` },
				{ label: `4 Stack`, value: `4` },
				{ label: `5 Stack`, value: `5` },
			],
		})]
	});

	const toggleLock = new ButtonBuilder({
		customId: `togglelock`,
		style: ButtonStyle.Secondary,
		emoji: `🔐`,
		label: `Toggle Lock`
	});

	const togglePrivate = new ButtonBuilder({
		customId: `toggleprivate`,
		style: ButtonStyle.Secondary,
		emoji: `👥`,
		label: `Toggle Privacy`
	});

	const subrow = new ActionRowBuilder({ components: [toggleLock, togglePrivate] });
	return await newVoiceChannel.send({ embeds: [embed], components: [memberLimitRole, subrow] });
}

/**
 * Function to remove a voice channel
 * @param {Client} client active BotClient instance
 * @param {Object} voiceChannel voiceState object
 */
async function voiceDelete(client, voiceChannel) {
	logger.log(`INFO`, `${voiceChannel.channel.name} was deleted`);
	return await voiceChannel.channel.delete();
}

function getTier(mmr, tierLines) {

	for (const tier in tierLines) {
		if (tierLines[tier].min <= mmr && mmr <= tierLines[tier].max) return tier;
	}
	return undefined;
}

async function dmJoinFailureReason(player, dmMessage, loggerMessage) {

	// Attempt to send a message to the user
	try {
		await player.send({ content: dmMessage });
		return await logger.log(`INFO`, loggerMessage);
	} catch (e) {
		logger.log(`WARNING`, `User ${player} (${player.user.username}) does not have DMs open & will not receive the combines join error message`);
	}
}