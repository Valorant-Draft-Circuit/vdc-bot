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
// const channelNames = weapons.map(n => `The Gamer ${n}™`);

const { ChannelType, BaseClient, VoiceState, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder } = require(`discord.js`);
const { CHANNELS, GUILD } = require(`../../utils/enums`);

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
		if (process.env.ENVIRONMENT === `DEV`) return;

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
	let username = ``;

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