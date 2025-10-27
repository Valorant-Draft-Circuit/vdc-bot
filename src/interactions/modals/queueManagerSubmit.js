const { Games, ControlPanel } = require(`../../../prisma`);
const { MessageFlags } = require(`discord.js`);
const { getRedisClient } = require(`../../core/redis`);
const { getQueueConfig } = require(`../../core/config`);
const { GameType } = require(`@prisma/client`);
const redis = getRedisClient();

module.exports = {
    id: `queueManager_submitModal`,
    /**
     * Handle the queue manager submit modal submission
     * @param {import('discord.js').ModalSubmitInteraction} interaction
     * @param {string} queueId
     */
    async execute(interaction, queueId) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const url = interaction.fields.getTextInputValue(`tracker_url`);

            const validMatchRegex = /^https:\/\/tracker.gg\/valorant\/match\/([a-z0-9]{8})-([a-z0-9]{4}-){3}([a-z0-9]{12})$/;
            if (!validMatchRegex.test(url)) return await interaction.editReply({ content: `That doesn't look like a valid match URL! Please try again or open a tech ticket!` });

            const gameID = url.replace(`https://tracker.gg/valorant/match/`, ``);
            const exists = await Games.exists({ id: gameID });
            if (exists) return await interaction.editReply({ content: `Looks like this match was already submitted!` });

            
            const matchKey = `vdc:match:${queueId}`;
            const matchData = await redis.hgetall(matchKey);

            if (!matchData || Object.keys(matchData).length === 0) {
                logger.log(`ERROR`, `Failed to parse tier from match data for submitted match ${queueId}`);
                return await interaction.editReply({ content: `Could not find match data for queue ID ${queueId}. Please open a tech ticket.` });
            }
            
            const tier = matchData.tier;

            // Verify user is in_match and in this match
            const playerKey = `vdc:player:${interaction.user.id}`;
            const [status, currentQueueId] = await redis.hmget(playerKey, `status`, `currentQueueId`);
            if (String(status) !== `in_match` || String(currentQueueId) !== String(queueId)) {
                return await interaction.editReply({ content: `You are not currently marked as in a match for ${queueId}. Only players in the match may submit results.` });
            }

            const teamA = (() => { try { return JSON.parse(matchData.teamAJSON || `[]`); } catch { return []; } })();
            const teamB = (() => { try { return JSON.parse(matchData.teamBJSON || `[]`); } catch { return []; } })();
            const players = Array.from(new Set([...(teamA || []), ...(teamB || [])]));
            if (!players.includes(interaction.user.id)) {
                return await interaction.editReply({ content: `You are not a participant in match ${queueId}. Only players in the match may submit results.` });
            }

            // check Riot match exists
            const riotMatchesV1 = `https://na.api.riotgames.com/val/match/v1/matches`;
            const response = await fetch(`${riotMatchesV1}/${gameID}?api_key=${process.env.VDC_API_KEY}`);
            const data = await response.json();
            if (data.matchInfo === undefined) return await interaction.editReply({ content: `There was a problem checking Riot's servers! Please try again or open a tech ticket!` });
            if (data.matchInfo.provisioningFlowId !== `CustomGame`) return await interaction.editReply({ content: `The match you submitted ([\`${gameID}\`](${url})) doesn't look like a custom game! Please double check your match and try again` });


            // call Games.saveMatch
            await Games.saveMatch({ id: gameID, tier: tier, type: GameType.COMBINE });

            // mark match completed in Redis and unlock players
            try {
                const matchKey = `vdc:match:${queueId}`;
                const pipeline = redis.pipeline();

                // update match hash
                pipeline.hset(matchKey, `status`, `completed`);
                pipeline.hset(matchKey, `trackerUrl`, url);
                pipeline.hset(matchKey, `endedAt`, String(Date.now()));

                // unlock players
                const affected = new Set(players.filter(Boolean));
                for (const playerId of affected) {
                    const key = `vdc:player:${playerId}`;
                    pipeline.hset(key, `status`, `idle`);
                    pipeline.hdel(key, `queuePriority`, `queueJoinedAt`, `currentQueueId`);
                       // increment combines/games played so the live Redis record reflects the submitted game
                       // this matches the shape written by buildCombineCountCache (gameCount)
                       pipeline.hincrby(key, 'gameCount', 1);
                }

                // apply anti-rematch recent sets now that the match is complete
                try {
                    const cfg = await getQueueConfig();
                    const recentTtlSeconds = Number(cfg?.recentSetTtlSeconds ?? 180) || 0;
                    if (recentTtlSeconds > 0) {
                        const affectedArr = Array.from(affected);
                        for (const playerId of affectedArr) {
                            const recentKey = `vdc:player:${playerId}:recent`;
                            for (const otherId of affectedArr) {
                                if (!otherId || otherId === playerId) continue;
                                pipeline.sadd(recentKey, otherId);
                            }
                            pipeline.expire(recentKey, recentTtlSeconds);
                        }
                    }
                } catch (err) {
                    // non-fatal: if fetching config fails, skip recent set update but continue
                    logger.log(`WARNING`, `Failed to apply recent-set anti-rematch updates for ${queueId}`, err);
                }

                // execute pipeline
                await pipeline.exec();

                await interaction.editReply({ content: `Match submission queued for processing and players have been unlocked. Channels have been queued for deletion.` });

                // attempt to cleanup channels for the match
                try {
                    const { deleteMatchChannels } = require(`../../core/matchChannels`);
                    const descriptor = (() => { try { return JSON.parse(matchData.channelIdsJSON || `{}`); } catch { return {}; } })();
                    const guild = interaction.guild;
                    await deleteMatchChannels(guild, descriptor);
                } catch (err) {
                    logger.log(`WARNING`, `Failed to cleanup channels for submitted match ${queueId}`, err);
                }

                // emit a match_completed event to vdc:events stream for dashboard/workers
                try {
                    await redis.xadd(`vdc:events`, `*`,
                        `type`, `match_completed`,
                        `queueId`, String(queueId),
                        `gameID`, String(gameID),
                        `tier`, String(tier ?? ``),
                        `initiatedBy`, String(interaction.user.id),
                        `timestamp`, String(Date.now()),
                        `players`, JSON.stringify(players)
                    );
                } catch (err) {
                    logger.log(`WARNING`, `Failed to emit match_completed event for ${queueId}`, err);
                }
            } catch (err) {
                logger.log(`WARNING`, `Failed to update Redis state/unlock players for submitted match ${gameID}`, err);
            }
        } catch (error) {
            logger.log(`ERROR`, `Failed processing match submit modal`, error);
            return await interaction.editReply({ content: `There was an error processing that submission.` });
        }
    },
};
