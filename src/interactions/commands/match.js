const { MessageFlags, EmbedBuilder } = require(`discord.js`);
const { getRedisClient } = require(`../../core/redis`);
const { getQueueConfig } = require(`../../core/queue/queueconfig`);
const {
	resolveCurrentQueueId,
	getQueueMatchContext,
	isUserBoundToQueueMatch,
	cancelQueueMatch,
} = require(`../../core/queue/matchLifecycle`);

module.exports = {
	name: `match`,

	/**
	 * @param {import('discord.js').ChatInputCommandInteraction} interaction
	 */
	async execute(interaction) {
		if (!interaction.inGuild()) {
			return interaction.reply({
				content: `Match commands must be run from the server.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		if (!(/true/i).test(process.env.QUEUE_SYSTEM_ENABLED)) {
			return interaction.reply({
				content: `The queue system is currently disabled by environment configuration.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		const subcommand = interaction.options.getSubcommand(true);

		switch (subcommand) {
			case `cancel`:
				return handleCancel(interaction);
			default:
				return interaction.reply({
						content: `That match action is not available. Use /submit for match submissions.`,
					flags: MessageFlags.Ephemeral,
				});
		}
	},
};

async function handleCancel(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const redis = getRedisClient();

	const queueId = await resolveCurrentQueueId(interaction.user.id).catch((err) => {
		logger.log(`WARNING`, `Failed to resolve queue id from player hash for ${interaction.user.id}`, err);
		return null;
	});
	if (!queueId) {
		return interaction.editReply({ content: `Unable to determine match context. Please run this command from the match text channel or provide the match ID.` });
	}

	const queueContext = await getQueueMatchContext(queueId);
	if (!queueContext) {
		return interaction.editReply({ content: `Match ${queueId} was not found.` });
	}
	const { queueMatchKey, matchData, players } = queueContext;

	const inMatch = await isUserBoundToQueueMatch(interaction.user.id, queueId);
	if (!inMatch) {
		return interaction.editReply({ content: `You are not currently marked as in a match for ${queueId}. Only players in the match may call this command.` });
	}
	if (!players.includes(interaction.user.id)) {
		return interaction.editReply({ content: `You are not a participant in match ${queueId}. Only players in the match may call this command.` });
	}

	const yesKey = `${queueMatchKey}:cancel_votes_yes`;
	const noKey = `${queueMatchKey}:cancel_votes_no`;
	await redis.sadd(yesKey, interaction.user.id);
	await redis.srem(noKey, interaction.user.id);
	const votes = await redis.scard(yesKey);

	const queueConfig = await getQueueConfig();
	const thresholdPercent = Number(queueConfig.cancelThreshold ?? 80);
	const percent = players.length ? Math.round((votes / players.length) * 100) : 0;

	if (percent >= thresholdPercent) {
		await cancelQueueMatch({
			guild: interaction.guild,
			queueContext,
			initiatedBy: interaction.user.id,
			yesCount: votes,
			noCount: await redis.scard(`${queueMatchKey}:cancel_votes_no`).catch(() => 0),
			yesVoters: await redis.smembers(`${queueMatchKey}:cancel_votes_yes`).catch(() => []),
		});

		logger.log(`WARNING`, `Match ${queueId} cancelled by vote (votes: ${votes}/${players.length})`);
		return interaction.editReply({ content: `Match ${queueId} has been cancelled (votes: ${votes}/${players.length}). Players have been unlocked and channels removed.` });
	}

	// If we reach here, no auto-cancel yet. Start a formal vote message if one isn't active.
	const cancelActive = await redis.get(`${queueMatchKey}:cancel_active`);
	const descriptor = (() => { try { return JSON.parse(matchData.channelIdsJSON || `{}`); } catch { return {}; } })();
	const textChannelId = descriptor.textChannelId ?? null;

	if (!cancelActive) {
		// construct vote embed + buttons
		if (!textChannelId) {
			return interaction.editReply({ content: `Unable to locate match chat to start a vote. Please contact a queue admin.` });
		}

		const channel = await interaction.client.channels.fetch(textChannelId).catch(() => null);
		if (!channel) return interaction.editReply({ content: `Unable to post vote to match chat.` });

		const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
		const yesButton = new ButtonBuilder().setCustomId(`matchCancel_yes-${queueId}`).setLabel(`Yes`).setStyle(ButtonStyle.Danger);
		const noButton = new ButtonBuilder().setCustomId(`matchCancel_no-${queueId}`).setLabel(`No`).setStyle(ButtonStyle.Secondary);

		const embed = new EmbedBuilder()
			.setTitle(`Cancel Vote — Match ${queueId}`)
			.setDescription(`${interaction.user} has started a vote to cancel this match. \n\n **If the match cancellation was denied by bad apples please open an admin ticket for help**`)
			.addFields(
				{ name: `Yes`, value: `${votes}`, inline: true },
				{ name: `No`, value: `0`, inline: true },
				{ name: `Players`, value: `${players.length}`, inline: true },
			)
			.setFooter({ text: `Required: ${thresholdPercent}% yes to cancel` });

		const message = await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(yesButton, noButton)] });
		await message.pin().catch(() => null);
		await redis.set(`${queueMatchKey}:cancel_active`, `1`);
		await redis.set(`${queueMatchKey}:cancel_message_id`, message.id);
		// set 5 minute TTLs
		await redis.expire(`${queueMatchKey}:cancel_active`, 300);
		await redis.expire(`${queueMatchKey}:cancel_message_id`, 300);
		await redis.expire(`${queueMatchKey}:cancel_votes_no`, 300).catch(() => {});
		await redis.expire(`${queueMatchKey}:cancel_votes_yes`, 300).catch(() => {});

		return interaction.editReply({ content: `Started a cancel vote in the match chat. Players may vote using the buttons.` });
	}

	// If a vote is already active, just show the current counts
	const cancelMsgId = await redis.get(`${queueMatchKey}:cancel_message_id`);
	const yesCount = await redis.scard(`${queueMatchKey}:cancel_votes_yes`);
	const noCount = await redis.scard(`${queueMatchKey}:cancel_votes_no`);
	return interaction.editReply({ content: `A cancel vote is already active in the match chat (${yesCount} yes / ${noCount} no).` });
}

