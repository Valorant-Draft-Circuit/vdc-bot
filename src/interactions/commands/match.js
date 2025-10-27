const { MessageFlags, EmbedBuilder } = require(`discord.js`);
const { getRedisClient } = require(`../../core/redis`);
const { getQueueConfig } = require(`../../core/config`);

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

		const subcommand = interaction.options.getSubcommand(true);

		switch (subcommand) {
			case `cancel`:
				return handleCancel(interaction);
			default:
				return interaction.reply({
					content: `That match action is not available. Use the separate /submit command or the match embed Submit button.`,
					flags: MessageFlags.Ephemeral,
				});
		}
	},
};

async function resolveQueueIdFromContext(interaction) {
	// Resolve queue id from Redis player hash only (currentQueueId)
	try {
		const redis = getRedisClient();
		const playerKey = `vdc:player:${interaction.user.id}`;
		const currentQueueId = await redis.hget(playerKey, `currentQueueId`);
		if (currentQueueId) return currentQueueId;
	} catch (err) {
		logger.log(`WARNING`, `Failed to resolve queue id from player hash for ${interaction.user.id}`, err);
	}

	return null;
}

async function handleCancel(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const redis = getRedisClient();

	const queueId = await resolveQueueIdFromContext(interaction);
	if (!queueId) {
		return interaction.editReply({ content: `Unable to determine match context. Please run this command from the match text channel or provide the match ID.` });
	}

	const matchKey = `vdc:match:${queueId}`;
	const matchData = await redis.hgetall(matchKey);
	if (!matchData || Object.keys(matchData).length === 0) {
		return interaction.editReply({ content: `Match ${queueId} was not found.` });
	}

	const teamA = (() => { try { return JSON.parse(matchData.teamAJSON || `[]`); } catch { return []; } })();
	const teamB = (() => { try { return JSON.parse(matchData.teamBJSON || `[]`); } catch { return []; } })();
	const players = Array.from(new Set([...(teamA || []), ...(teamB || [])]));

	// Verify user is in_match and belongs to this match
	const playerKey = `vdc:player:${interaction.user.id}`;
	const [status, currentQueueId] = await redis.hmget(playerKey, `status`, `currentQueueId`);
	if (String(status) !== `in_match` || String(currentQueueId) !== String(queueId)) {
		return interaction.editReply({ content: `You are not currently marked as in a match for ${queueId}. Only players in the match may call this command.` });
	}
	if (!players.includes(interaction.user.id)) {
		return interaction.editReply({ content: `You are not a participant in match ${queueId}. Only players in the match may call this command.` });
	}

	const yesKey = `${matchKey}:cancel_votes_yes`;
	const noKey = `${matchKey}:cancel_votes_no`;
	await redis.sadd(yesKey, interaction.user.id);
	await redis.srem(noKey, interaction.user.id);
	const votes = await redis.scard(yesKey);

	const queueConfig = await getQueueConfig();
	const thresholdPercent = Number(queueConfig.cancelThreshold ?? 80);
	const percent = players.length ? Math.round((votes / players.length) * 100) : 0;

	if (percent >= thresholdPercent) {
		// cancel the match: reset players and delete keys
		const pipeline = redis.pipeline();
		const affected = new Set(players.filter(Boolean));
		for (const playerId of affected) {
			const key = `vdc:player:${playerId}`;
			pipeline.hset(key, `status`, `idle`);
			pipeline.hdel(key, `queuePriority`, `queueJoinedAt`, `currentQueueId`);
			pipeline.del(`${key}:recent`);
			pipeline.pexpire(key, 43200000);
		}

		pipeline.del(matchKey);
		await pipeline.exec();

		// attempt to cleanup channels
		try {
			const { deleteMatchChannels } = require(`../../core/matchChannels`);
			const descriptor = JSON.parse(matchData.channelIdsJSON || `{}`);
			const guild = interaction.guild;
			await deleteMatchChannels(guild, descriptor);
		} catch (err) {
			logger.log(`WARNING`, `Failed to cleanup channels for cancelled match ${queueId}`, err);
		}

		logger.log(`ALERT`, `Match ${queueId} cancelled by vote (votes: ${votes}/${players.length})`);
		return interaction.editReply({ content: `Match ${queueId} has been cancelled (votes: ${votes}/${players.length}). Players have been unlocked and channels removed.` });
	}

	// If we reach here, no auto-cancel yet. Start a formal vote message if one isn't active.
	const cancelActive = await redis.get(`${matchKey}:cancel_active`);
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
		await redis.set(`${matchKey}:cancel_active`, `1`);
		await redis.set(`${matchKey}:cancel_message_id`, message.id);
		// set 5 minute TTLs
		await redis.expire(`${matchKey}:cancel_active`, 300);
		await redis.expire(`${matchKey}:cancel_message_id`, 300);
		await redis.expire(`${matchKey}:cancel_votes_no`, 300).catch(() => {});
		await redis.expire(`${matchKey}:cancel_votes_yes`, 300).catch(() => {});

		return interaction.editReply({ content: `Started a cancel vote in the match chat. Players may vote using the buttons.` });
	}

	// If a vote is already active, just show the current counts
	const cancelMsgId = await redis.get(`${matchKey}:cancel_message_id`);
	const yesCount = await redis.scard(`${matchKey}:cancel_votes_yes`);
	const noCount = await redis.scard(`${matchKey}:cancel_votes_no`);
	return interaction.editReply({ content: `A cancel vote is already active in the match chat (${yesCount} yes / ${noCount} no).` });
}

