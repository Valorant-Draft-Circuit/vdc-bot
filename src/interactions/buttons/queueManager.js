const { MessageFlags, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder } = require(`discord.js`);
const { getRedisClient } = require(`../../core/redis`);

const BUTTON_LABELS = {
	joinLobby: `Join Lobby VC`,
	joinAttackers: `Join Attackers VC`,
	joinDefenders: `Join Defenders VC`,
	submit: `Submit Match Link`,
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
		const queueId = separatorIndex === -1 ? `` : action.slice(separatorIndex + 1);
		const label = BUTTON_LABELS[command] ?? `Queue Action`;

		if (!queueId) {
			return interaction.reply({
				content: `Missing match information for this action.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		if (command === `submit`) {
				// show a modal to collect the tracker.gg URL
				try {
					const modal = new ModalBuilder()
						.setTitle(`Submit Match Link`)
						.setCustomId(`queueManager_submitModal-${queueId}`);

					const input = new TextInputBuilder()
						.setCustomId(`tracker_url`)
						.setStyle(TextInputStyle.Short)
						.setPlaceholder(`https://tracker.gg/valorant/match/...`)
						.setRequired(true);

					const label = new LabelBuilder()
						.setLabel(`Tracker.gg match URL`)
						.setTextInputComponent(input);

					modal.addLabelComponents(label);

					return await interaction.showModal(modal);
				} catch (error) {
					logger.log(`ERROR`, `Failed to show submit modal`, error);
					return interaction.reply({ content: `Unable to open submission modal right now.`, flags: MessageFlags.Ephemeral });
				}
		}

		try {
			const inviteUrl = await createVoiceInvite(interaction, queueId, command);
			if (!inviteUrl) {
				return interaction.reply({
					content: `Unable to locate an appropriate voice channel for this match.`,
					flags: MessageFlags.Ephemeral,
				});
			}

			return interaction.reply({
				content: `${label} ready! Use this invite (expires in 30 seconds): ${inviteUrl}`,
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			logger.log(`ERROR`, `Failed to create queue invite`, error);
			return interaction.reply({
				content: `We couldn't generate an invite right now. Please try again shortly.`,
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};

async function createVoiceInvite(interaction, queueId, command) {
	const redis = getRedisClient();
	const descriptorRaw = await redis.hget(`vdc:match:${queueId}`, `channelIdsJSON`);
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
		maxUses: 1,
		unique: true,
		reason: `Queue quick join for match ${queueId}`,
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
		case `joinDefenders`:
			return voice.teamB;
		default:
			return null;
	}
}