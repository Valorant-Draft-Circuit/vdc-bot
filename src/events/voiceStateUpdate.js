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

const { ChannelType, BaseClient, GuildMember, VoiceState, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder } = require(`discord.js`);
const { CHANNELS, GUILD, ROLES } = require(`../../utils/enums`);
const { LeagueStatus } = require(`@prisma/client`);

const category = `963274331864047617`; 	// ID for VC category
const afk = `1328972180549013596`;		// ID for AFK channel

const botCommandsChannelID = `966216243986194432`;
const enableSort = (/true/i).test(process.env.COMBINES_SORT);

const allowedLeagueStatuses = [
	LeagueStatus.DRAFT_ELIGIBLE,
	LeagueStatus.FREE_AGENT,
	LeagueStatus.GENERAL_MANAGER,
	LeagueStatus.RESTRICTED_FREE_AGENT,
	LeagueStatus.SIGNED
];

// voiceState properties to ignore
const IGNORED_PROPERTIES = [
	`selfMute`, `selfDeaf`, `selfVideo`, `serverMute`, `serverDeaf`, `streaming`, `suppress`,
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
		if (oldState.guild.id !== GUILD) return;
		if (!Boolean(Number(process.env.PROD))) return;


		// If no relevant (non-ignored) changes, skip. only relevant actions should be join/leave
		const hasNonIgnoredChange = Object.keys(newState).some(key => {
			return oldState[key] !== newState[key] && !IGNORED_PROPERTIES.includes(key);
		});
		if (!hasNonIgnoredChange) return;


		/** Standard Join/Leave Button (The Range) */
		/* ########################################################################### */

		// join paramaters
		const joinedCategoryBool = newState.channel?.parentId === category;		// true if user joins the VC category
		const joinedLobbyBool = newState.channelId === CHANNELS.VC.LOBBY;		// true if user joins the lobby VC
		const joinedAFKBool = newState.channelId === afk;						// true if user joins AFK VC

		// leave paramaters
		const leftVCBool = channelNames.includes(oldState.channel?.name);
		const leftChannelMemberCount = oldState.channel?.members.map(m => m).length;


		// dynamic VC logic
		if (leftVCBool && joinedLobbyBool && leftChannelMemberCount === 0) {
			await voiceDelete(client, oldState);
			return await voiceCreate(client, oldState, newState);
		};
		if (joinedLobbyBool) {
			return await voiceCreate(client, oldState, newState);
		};
		if (leftVCBool && leftChannelMemberCount === 0) {
			return await voiceDelete(client, oldState);
		};


		// modify channel perms - happens last for optimization- if user is last in channel & leaves- no reason to modify channel perms before deleting
		if (joinedCategoryBool && !joinedAFKBool && !joinedLobbyBool) {
			const user = newState.member;
			await modifyChannelPerms(newState, user, `ADD`);
		};
		if (leftVCBool) {
			const user = oldState.member;
			await modifyChannelPerms(oldState, user, `REMOVE`);
		};
		/* ########################################################################### */


		if (!enableSort) return;

		/** Combines VC Sorting */
		/* ########################################################################### */
		const sortChannel = CHANNELS.VC.COMBINES.SORT_CHANNEL;
		const joinedCombinesLobbyBool = newState?.channelId === sortChannel;

		const tierCategories = Object.values(CHANNELS.VC.COMBINES.COMBINE_CATEGORY);
		const isInCombinesCategory = tierCategories.includes(newState?.channel?.parent?.id);

		// check roles
		const m = newState?.member;
		const userRoles = m.roles.cache.map(r => r.id);
		const isScout = userRoles.includes(ROLES.OPERATIONS.SCOUT);
		const isAdmin = userRoles.includes(ROLES.OPERATIONS.ADMIN);
		const isMod = userRoles.includes(ROLES.OPERATIONS.MOD);

		// if they join any combines channels without completing the activity check, disconnect them regardless of GM status
		if ((joinedCombinesLobbyBool || isInCombinesCategory) && userRoles.includes(ROLES.LEAGUE.INACTIVE)) {
			sendDM(m, `You have not completed the activity check and cannot partipate in combines until you do so- please complete it by using the \`/active\` command in <#${botCommandsChannelID}> channel!`);
			logger.log(`ALERT`, `User ${m.user} (\`${m.user.username}\`, \`${m.id}\`) joined a combines channel without first having completed the activity check & have been disconnected`);
			return await m.voice.disconnect();
		}

		// if a player joines the combines lobby, verify valid MMR and then move them to the correct channel
		if (joinedCombinesLobbyBool) {							// else check mmr and status
			// get player MMR
			const mmr = Number(mmrCache.find(mmr => mmr.discordID === m.id)?.mmr);
			const playerTier = getTier(mmr);

			// get player league status
			const playerLeagueStatus = mmrCache.find(mmr => mmr.discordID === m.id)?.ls;
			const isValidStatus = allowedLeagueStatuses.includes(playerLeagueStatus);

			if (playerTier && isValidStatus) {					// valid MMR and status
				const channel = CHANNELS.VC.COMBINES.WAITING_ROOM[playerTier];
				return await m.voice.setChannel(channel);
			} else {											// not a valid MMR or valid status
				sendDM(m, `There is a problem with your account (invalid MMR, or status) and you cannot join <#${CHANNELS.VC.COMBINES.SORT_CHANNEL}> currently. If you believe this is an error, please open an admin ticket: <#966924427709276160>`);
				logger.log(`ALERT`, `User ${m.user} (\`${m.user.username}\`, \`${m.id}\`) joined <#${sortChannel}> with an invalid MMR (\`${mmr}\`) or invalid status (\`${playerLeagueStatus}\`) & have been disconnected`);
				return await m.voice.disconnect();
			}
		}

		// if the player joins a channel in the commbines category, confirm that they are a scout or a player with a valid MMR
		if (isInCombinesCategory) {
			if (isScout || isAdmin || isMod) {					// if the user is a scout, admin or mod, ignore all restrictions
				return console.log(`User ${m.user} (\`${m.user.username}\`, \`${m.id}\`) joined ${newState.channel.name} as a scout/admin/mod. They have been allowed to join`);
			} else {											// else check mmr and status
				// get player MMR
				const mmr = Number(mmrCache.find(mmr => mmr.discordID === m.id)?.mmr);
				const playerTier = getTier(mmr);

				// get player league status
				const playerLeagueStatus = mmrCache.find(mmr => mmr.discordID === m.id)?.ls;
				const isValidStatus = allowedLeagueStatuses.includes(playerLeagueStatus);
				const isInCorrectTier = playerTier === m.voice.channel.parent.name.toUpperCase().replace(`COMBINES - `, ``);

				if (!playerTier) {								// invalid MMR
					sendDM(m, `You have joined a combines channel, but you do not have a valid MMR. If you believe this is an error, please open an admin ticket: <#966924427709276160>`);
					logger.log(`ALERT`, `User ${m.user} (\`${m.user.username}\`, \`${m.id}\`) joined ${newState.channel} (\`${newState.channel.name}\`) with an invalid MMR (\`${mmr}\`) & have been disconnected`);
					return await m.voice.disconnect();
				} else if (!isValidStatus) {					// invalid status
					sendDM(m, `You have joined a combines channel, but you do not have a valid status. If you believe this is an error, please open an admin ticket: <#966924427709276160>`);
					logger.log(`ALERT`, `User ${m.user} (\`${m.user.username}\`, \`${m.id}\`) joined ${newState.channel} (\`${newState.channel.name}\`) with an invalid status (\`${playerLeagueStatus}\`) & have been disconnected`);
					return await m.voice.disconnect();
				} else if (!isInCorrectTier) {					// invalid tier
					sendDM(m, `You have joined a combines channel, but are not in the correct tier- I expected to see you in a \`${playerTier}\` lobby! I've moved you to <#${CHANNELS.VC.COMBINES.SORT_CHANNEL}> to be sorted to the right tier, but in the future, please join that channel at the beginning of each combines night! If you believe this is an error, please open an admin ticket: <#966924427709276160>`);
					logger.log(`ALERT`, `User ${m.user} (\`${m.user.username}\`, \`${m.id}\`) joined ${newState.channel} (\`${newState.channel.name}\`)- expected to see them in a \`${playerTier}\` lobby. They have been moved to <#${CHANNELS.VC.COMBINES.SORT_CHANNEL}> to be sorted correctly`);
					return await m.voice.setChannel(CHANNELS.VC.COMBINES.SORT_CHANNEL);
				} else {										// valid MMR, tier and status
					return console.log(`User ${m.user} (\`${m.user.username}\`, \`${m.id}\`) joined ${m.voice.channel} (${m.voice.channel.name}) with an MMR of \`${mmr}\`, leagueStatus of \`${playerLeagueStatus}\` & tier of \`${playerTier}\``);
				}
			}
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

	newState.member.voice.setChannel(newVoiceChannel.id);
	logger.log(`INFO`, `\`${newState.member.user.username}\` was moved to ${newVoiceChannel.name}`);

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

function getTier(mmr) {
	for (const tier in mmrTierLinesCache) {
		if (mmrTierLinesCache[tier].min <= mmr && mmr <= mmrTierLinesCache[tier].max) return tier;
	}
	return undefined;
}

async function sendDM(player, dmMessage) {
	// Attempt to send a message to the user
	try {
		await player.send({ content: dmMessage });
	} catch (e) {
		logger.log(`WARNING`, `User ${player} (\`${player.user.username}\`, \`${player.id}\`) does not have DMs open & will not receive the combines join error messages`);
	}
}

/** Modify channel permissions */
async function modifyChannelPerms(
	/** @type VoiceState */ voiceChannel,
	/** @type GuildMember */ member,
	/** @type {`ADD`|`REMOVE`} */ type
) {
	if (type === `ADD`) {
		logger.log(`VERBOSE`, `Added permission overrides for \`${member.user.username}\` in \`${voiceChannel.channel.name}\``);
		return await voiceChannel.channel.permissionOverwrites.create(member, {
			ViewChannel: true,
			Connect: true,
			SendMessages: true,
		});
	} else {
		logger.log(`VERBOSE`, `Removed permission overrides for \`${member.user.username}\` in \`${voiceChannel.channel.name}\``);
		return await voiceChannel.channel.permissionOverwrites.delete(member);
	}
}
