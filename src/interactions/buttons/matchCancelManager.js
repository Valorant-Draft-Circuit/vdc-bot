const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { getRedisClient } = require(`../../core/redis`);

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
        const matchKey = `vdc:match:${queueId}`;
        const matchData = await redis.hgetall(matchKey);
        if (!matchData || Object.keys(matchData).length === 0) {
            return interaction.reply({ content: `Match ${queueId} not found.`, flags: MessageFlags.Ephemeral });
        }

        const teamA = (() => { try { return JSON.parse(matchData.teamAJSON || `[]`); } catch { return []; } })();
        const teamB = (() => { try { return JSON.parse(matchData.teamBJSON || `[]`); } catch { return []; } })();
        const players = Array.from(new Set([...(teamA || []), ...(teamB || [])]));

        // verify caller is participant and in_match
        const playerKey = `vdc:player:${interaction.user.id}`;
        const [status, currentQueueId] = await redis.hmget(playerKey, `status`, `currentQueueId`);
        if (String(status) !== `in_match` || String(currentQueueId) !== String(queueId)) {
            return interaction.reply({ content: `Only players in the match may vote.`, flags: MessageFlags.Ephemeral });
        }
        if (!players.includes(interaction.user.id)) {
            return interaction.reply({ content: `Only players in the match may vote.`, flags: MessageFlags.Ephemeral });
        }

    const yesKey = `${matchKey}:cancel_votes_yes`;
    const noKey = `${matchKey}:cancel_votes_no`;

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
        const config = require(`../../core/config`).DEFAULT_QUEUE_CONFIG;
        const cancelThreshold = Number((await require(`../../core/config`).getQueueConfig()).cancelThreshold ?? config.cancelThreshold);
        const percent = total ? Math.round((yesCount / total) * 100) : 0;

        // set 5 minute TTLs on vote keys & cancel keys
            try {
                await redis.expire(yesKey, 300);
                await redis.expire(noKey, 300);
                await redis.expire(`${matchKey}:cancel_active`, 300);
                await redis.expire(`${matchKey}:cancel_message_id`, 300);
            } catch (err) {}

        // update vote message if present
        const cancelMsgId = await redis.get(`${matchKey}:cancel_message_id`);
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
            // cancel match: reset players and delete keys
            const pipeline = redis.pipeline();
            const affected = new Set(players.filter(Boolean));
            for (const playerId of affected) {
                const key = `vdc:player:${playerId}`;
                pipeline.hset(key, `status`, `idle`);
                pipeline.hdel(key, `queuePriority`, `queueJoinedAt`, `currentQueueId`);
                pipeline.del(`${key}:recent`);
                pipeline.pexpire(key, 43200000);
            }

            pipeline.del(matchKey, yesKey, noKey, `${matchKey}:cancel_active`, `${matchKey}:cancel_message_id`);
            await pipeline.exec();

            // emit a central event so external systems (dashboard/etc) can record the cancellation
            try {
                const now = Date.now();
                const tier = matchData.tier ?? ``;
                const eventFields = [
                    `type`, `match_canceled`,
                    `queueId`, queueId,
                    `tier`, tier,
                    `timestamp`, String(now),
                    `initiatedBy`, interaction.user.id,
                    `yesCount`, String(yesCount),
                    `noCount`, String(noCount),
                    `players`, JSON.stringify(players),
                    `yesVoters`, JSON.stringify(yesVoters || []),
                ];

                await redis.xadd(`vdc:events`, `*`, ...eventFields).catch(() => null);
            } catch (err) {
                // don't block cancel flow for event emission failures
            }

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

            logger.log(`ALERT`, `Match ${queueId} cancelled by vote (votes: ${yesCount}/${total})`);
            interaction.reply({ content: `Vote passed (${yesCount}/${total}, ${percent}%). Match has been cancelled.`, flags: MessageFlags.Ephemeral });

            // attempt to cleanup channels
            try {
                const { deleteMatchChannels } = require(`../../core/matchChannels`);
                const guild = interaction.guild;
                const descriptor = JSON.parse(matchData.channelIdsJSON || `{}`);
                await deleteMatchChannels(guild, descriptor);
            } catch (err) {
                logger.log(`WARNING`, `Failed to cleanup channels for cancelled match ${queueId}`, err);
            }
        }

        return interaction.reply({ content: `Your vote has been recorded. Current: ${yesCount} yes / ${noCount} no (${percent}% yes).`, flags: MessageFlags.Ephemeral });
    },
};
