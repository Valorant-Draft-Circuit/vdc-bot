const { MessageFlags } = require(`discord.js`);
const { getRedisClient } = require(`../../core/redis`);

const BUTTON_LABELS = {
	joinLobby: `Join Lobby VC`,
	joinAttackers: `Join Attackers VC`,
	joinDef: `Join Defenders VC`,
	submit: `Submit Result`,
};

module.exports = {
	id: `queueManagerManager`,

	/**
	 * @param {import('discord.js').ButtonInteraction} interaction
	 * @param {string} action
	 */
	async execute(interaction, action = ``) {
		const separatorIndex = action.indexOf(`-`);
		const command = separatorIndex === -1 ? action : action.slice(0, separatorIndex);
		const matchId = separatorIndex === -1 ? `` : action.slice(separatorIndex + 1);
		const label = BUTTON_LABELS[command] ?? `Queue Action`;

		if (!matchId) {
			return interaction.reply({
				content: `Missing match information for this action.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		if (command === `submit`) {
			return interaction.reply({
				content: `Game submission flow is still being wired up. Sit tight!`,
				flags: MessageFlags.Ephemeral,
			});
		}

		try {
			const inviteUrl = await createVoiceInvite(interaction, matchId, command);
			if (!inviteUrl) {
				return interaction.reply({
					content: `Unable to locate an appropriate voice channel for this match.`,
					flags: MessageFlags.Ephemeral,
				});
			}

			return interaction.reply({
				content: `${label} ready! Use this invite (expires in 30 minutes): ${inviteUrl}`,
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			log(`ERROR`, `Failed to create queue invite`, error);
			return interaction.reply({
				content: `We couldn't generate an invite right now. Please try again shortly.`,
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};

async function createVoiceInvite(interaction, matchId, command) {
	const redis = getRedisClient();
	const descriptorRaw = await redis.hget(`vdc:match:${matchId}`, `channelIdsJSON`);
	if (!descriptorRaw) return null;

	let descriptor;
	try {
		descriptor = JSON.parse(descriptorRaw);
	} catch {
		return null;
	}

	const targetChannelId = selectChannelId(command, descriptor);
	if (!targetChannelId) return null;

	const channel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);
	if (!channel || typeof channel.createInvite !== `function`) return null;

	const invite = await channel.createInvite({
		maxAge: 30,
		maxUses: 10,
		unique: true,
		reason: `Queue quick join for match ${matchId}`,
	});

	return invite?.url ?? null;
}

function selectChannelId(command, descriptor) {
	if (!descriptor || typeof descriptor !== `object`) return null;

	const voice = descriptor.voiceChannelIds ?? {};

	switch (command) {
		case `joinLobby`:
			return voice.lobby;
		case `joinAttackers`:
			return voice.teamA;
		case `joinDef`:
			return voice.teamB;
		default:
			return null;
	}
}

function log(level, message, error) {
	if (global.logger && typeof global.logger.log === `function`) {
		global.logger.log(level, message, error);
	} else if (error) {
		console.log(`[${level}] ${message} :: ${error.message || error}`);
	} else {
		console.log(`[${level}] ${message}`);
	}
}
