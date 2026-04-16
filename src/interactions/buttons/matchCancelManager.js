const { MessageFlags, EmbedBuilder } = require(`discord.js`);
const { getRedisClient } = require(`../../core/redis`);
const { DEFAULT_QUEUE_CONFIG, getQueueConfig } = require(`../../core/queue/queueconfig`);
const {
    getQueueMatchContext,
    isUserBoundToQueueMatch,
    cancelQueueMatch,
} = require(`../../core/queue/matchLifecycle`);

module.exports = {
    id: `matchCancelManager`,

    /**
     * @param {import('discord.js').ButtonInteraction} interaction
     * @param {string} action
     */
    async execute(interaction, action = ``) {
    const separatorIndex = action.indexOf(`-`);
    const command = separatorIndex === -1 ? action : action.slice(0, separatorIndex);
    const queueId = separatorIndex === -1 ? `` : action.slice(separatorIndex + 1);

        if (!queueId) {
            return interaction.reply({ content: `Missing match information for this vote.`, flags: MessageFlags.Ephemeral });
        }

        const redis = getRedisClient();
        const queueContext = await getQueueMatchContext(queueId);
        if (!queueContext) {
            return interaction.reply({ content: `Match ${queueId} not found.`, flags: MessageFlags.Ephemeral });
        }
        const { queueMatchKey, matchData, players } = queueContext;

        // verify caller is participant and in_match
        const inMatch = await isUserBoundToQueueMatch(interaction.user.id, queueId);
        if (!inMatch) {
            return interaction.reply({ content: `Only players in the match may vote.`, flags: MessageFlags.Ephemeral });
        }
        if (!players.includes(interaction.user.id)) {
            return interaction.reply({ content: `Only players in the match may vote.`, flags: MessageFlags.Ephemeral });
        }

    const yesKey = `${queueMatchKey}:cancel_votes_yes`;
    const noKey = `${queueMatchKey}:cancel_votes_no`;

        if (command === `yes`) {
            await redis.sadd(yesKey, interaction.user.id);
            await redis.srem(noKey, interaction.user.id);
        } else if (command === `no`) {
            await redis.sadd(noKey, interaction.user.id);
            await redis.srem(yesKey, interaction.user.id);
        } else {
            return interaction.reply({ content: `Unknown vote action.`, flags: MessageFlags.Ephemeral });
        }

        // compute counts
        const yesCount = await redis.scard(yesKey);
        const noCount = await redis.scard(noKey);
        const total = players.length;
        const cancelThreshold = Number((await getQueueConfig()).cancelThreshold ?? DEFAULT_QUEUE_CONFIG.cancelThreshold);
        const percent = total ? Math.round((yesCount / total) * 100) : 0;

        // set 5 minute TTLs on vote keys & cancel keys
            try {
                await redis.expire(yesKey, 300);
                await redis.expire(noKey, 300);
                await redis.expire(`${queueMatchKey}:cancel_active`, 300);
                await redis.expire(`${queueMatchKey}:cancel_message_id`, 300);
            } catch (err) {}

        // update vote message if present
        const cancelMsgId = await redis.get(`${queueMatchKey}:cancel_message_id`);
        const descriptor = (() => { try { return JSON.parse(matchData.channelIdsJSON || `{}`); } catch { return {}; } })();
        const textChannelId = descriptor.textChannelId ?? null;
        if (cancelMsgId && textChannelId) {
            try {
                const channel = await interaction.client.channels.fetch(textChannelId).catch(() => null);
                if (channel) {
                    const message = await channel.messages.fetch(cancelMsgId).catch(() => null);
                    if (message) {
                        const embed = new EmbedBuilder()
                            .setTitle(`Cancel Vote — Match ${queueId}`)
                            .setDescription(`Vote to cancel this match is in progress. \n\n **If the match cancellation was denied by bad apples please open an admin ticket for help**`)
                            .addFields(
                                { name: `Yes`, value: `${yesCount}`, inline: true },
                                { name: `No`, value: `${noCount}`, inline: true },
                                { name: `Players`, value: `${total}`, inline: true },
                            )
                            .setFooter({ text: `Required: ${cancelThreshold}% yes to cancel` });

                        await message.edit({ embeds: [embed] }).catch(() => null);
                    }
                }
            } catch (err) {
                // ignore
            }
        }

        // check threshold
        if (percent >= cancelThreshold) {
            // capture voters before we delete the keys so we can emit an event
            let yesVoters = [];
            try {
                yesVoters = await redis.smembers(yesKey).catch(() => []);
            } catch (err) {
                yesVoters = [];
            }
            await cancelQueueMatch({
				guild: interaction.guild,
				queueContext,
				initiatedBy: interaction.user.id,
				yesCount,
				noCount,
				yesVoters,
			});

            // edit vote message to indicate cancellation
            if (cancelMsgId && textChannelId) {
                try {
                    const channel = await interaction.client.channels.fetch(textChannelId).catch(() => null);
                    if (channel) {
                        const message = await channel.messages.fetch(cancelMsgId).catch(() => null);
                        if (message) {
                            const embed = new EmbedBuilder().setTitle(`Match ${queueId} Cancelled`).setDescription(`Vote passed (${yesCount}/${total}, ${percent}%). Match has been cancelled.`);
                            await message.edit({ embeds: [embed], components: [] }).catch(() => null);
                        }
                    }
                } catch (err) {}
            }

            logger.log(`WARNING`, `Match ${queueId} cancelled by vote (votes: ${yesCount}/${total})`);
            interaction.reply({ content: `Vote passed (${yesCount}/${total}, ${percent}%). Match has been cancelled.`, flags: MessageFlags.Ephemeral });
			return;
        }

        return interaction.reply({ content: `Your vote has been recorded. Current: ${yesCount} yes / ${noCount} no (${percent}% yes).`, flags: MessageFlags.Ephemeral });
    },
};
