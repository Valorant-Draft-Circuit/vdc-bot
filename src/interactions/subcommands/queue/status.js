const { MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { getRedisClient } = require(`../../../core/redis`);
const { TIERS_SET_KEY, tierQueueKeys, matchKeyPattern } = require(`../../../helpers/queue/queueKeys`);

const MAX_EMBED_FIELDS = 25; // Discord's limit for fields in an embed. needed to paginate tier specific queue results

async function getQueueTierStatus(interaction, tier_arg) {
    const listKeys = tierQueueKeys(tier_arg, { includeCompleted: false });
    const rows = [];
    const paginatedEmbeds = [];

    //i have no clue if this is how you get the users in the queue from redis. change this if needed
    //this is my best guess because idk what the structure of the queue data is
    const results = await Promise.all(listKeys.map((k) => redis.lrange(k, 0, -1).catch(() => [])));

    const byBucket = Object.fromEntries(
        QUEUE_BUCKETS.map((bucket, i) => [bucket, results[i]])
    );

    for (const [bucket, users] of Object.entries(byBucket)) {
        for (const u of users) {
            rows.push({ status: bucket, user: u });
        }
    }

    const userCount = results.flat().length;

    const embed = new EmbedBuilder()
        .setTitle(`Queued members in ${tier_arg} (${userCount})`)
        .setColor(0x5865F2);

    if (userCount > MAX_EMBED_FIELDS) {
        // paginate results
        for (let i = 0; i < rows.length; i += MAX_EMBED_FIELDS) {
            const pageRows = rows.slice(i, i + MAX_EMBED_FIELDS);
            const pageEmbed = embed.clone();
            for (const r of pageRows) {
                pageEmbed.addFields({ name: r.status, value: r.user, inline: true });
            }
            paginatedEmbeds.push(pageEmbed);
        }

        let currentPage = 0;

        const prevButton = new ButtonBuilder()
            .setCustomId('prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true); // disabled on first page

        const nextButton = new ButtonBuilder()
            .setCustomId('next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(currentPage === paginatedEmbeds.length - 1);

        const buttons = new ActionRowBuilder().addComponents(prevButton, nextButton);
        const reply = await interaction.editReply({ embeds: [paginatedEmbeds[currentPage]], components: [buttons] });
        const collector = reply.createMessageComponentCollector({ time: 60_000 });

        collector.on('collect', async (buttonInteraction) => {

            if (buttonInteraction.customId === 'prev') currentPage--;
            if (buttonInteraction.customId === 'next') currentPage++;

            prevButton.setDisabled(currentPage === 0);
            nextButton.setDisabled(currentPage === paginatedEmbeds.length - 1);

            await buttonInteraction.update({
                embeds: [paginatedEmbeds[currentPage]],
                components: [new ActionRowBuilder().addComponents(prevButton, nextButton)],
            });
        });

        // Disable buttons when the collector expires
        collector.on('end', async () => {
            prevButton.setDisabled(true);
            nextButton.setDisabled(true);
            await interaction.editReply({ components: [new ActionRowBuilder().addComponents(prevButton, nextButton)] });
        });

    }
    else {
        for (const r of rows) {
            embed.addFields({ name: `${r.status}`, value: ` ${r.user}`, inline: true });
        }
    }

    return interaction.editReply({ embeds: [embed] });
}

async function status(interaction, tier_arg) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const redis = getRedisClient();
    try {
        const tiers = await redis.smembers(TIERS_SET_KEY);
        if (!Array.isArray(tiers) || tiers.length === 0) {
            return interaction.editReply({ content: `No tiers are currently registered.` });
        }

        const rows = [];

        if (tier_arg) {
            if (!tiers.includes(tier_arg)) {
                return interaction.editReply({ content: `Tier "${tier_arg}" does not exist.` });
            }
            else {
                return getQueueTierStatus(interaction, tier_arg);
            }
        }

        // Build base tier queue counts
        for (const tier of tiers) {
            if (!tier) continue;

            const listKeys = tierQueueKeys(tier, { includeCompleted: true });

            // run LLEN for each list and sum
            const counts = await Promise.all(listKeys.map((k) => redis.llen(k).catch(() => 0)));
            const sum = counts.reduce((acc, v) => acc + (Number(v) || 0), 0);
            rows.push({ tier, queued: sum, ongoingMatches: 0 });
        }

        // Count ongoing matches per tier by scanning match keys and reading their tier/status fields.
        try {
            let cursor = `0`;
            const matchKeys = [];
            do {
                const [nextCursor, results] = await redis.scan(cursor, `MATCH`, matchKeyPattern(), `COUNT`, 250);
                cursor = nextCursor;
                if (Array.isArray(results) && results.length) matchKeys.push(...results);
            } while (cursor !== `0`);

            if (matchKeys.length > 0) {
                // Process in batches to avoid huge HMGETs
                const batchSize = 100;
                for (let i = 0; i < matchKeys.length; i += batchSize) {
                    const batch = matchKeys.slice(i, i + batchSize);
                    const pipeline = redis.pipeline();
                    for (const key of batch) pipeline.hmget(key, `tier`, `status`);
                    const results = await pipeline.exec();
                    for (let j = 0; j < results.length; j++) {
                        const [err, vals] = results[j];
                        if (err) continue;
                        const tierVal = vals && vals[0] ? String(vals[0]) : null;
                        const statusVal = vals && vals[1] ? String(vals[1]) : null;
                        if (!tierVal) continue;
                        // consider ongoing if status is not 'completed'
                        if (String(statusVal || ``).toLowerCase() !== `completed`) {
                            const row = rows.find((r) => String(r.tier) === String(tierVal));
                            if (row) row.ongoingMatches = (row.ongoingMatches || 0) + 1;
                            else rows.push({ tier: tierVal, queued: 0, ongoingMatches: 1 });
                        }
                    }
                }
            }
        } catch (err) {
            // non-fatal: if match scanning fails, log and continue with queued counts only
            logger.log && logger.log(`WARNING`, `Failed to compute ongoing match counts`, err);
        }

        // Sort tiers alphabetically for stable output
        rows.sort((a, b) => String(a.tier).localeCompare(String(b.tier)));

        const embed = new EmbedBuilder()
            .setTitle(`Queue Status — Tier Counts`)
            .setColor(0x5865F2);

        for (const r of rows) {
            embed.addFields({ name: `${r.tier}`, value: `Queued: ${r.queued}\nOngoing matches: ${r.ongoingMatches || 0}`, inline: true });
        }

        return interaction.editReply({ embeds: [embed] });
    } catch (error) {
        logger.log && logger.log(`ERROR`, `Failed to build queue status`, error);
        return interaction.editReply({ content: `Unable to fetch queue status right now.` });
    }
}

module.exports = {
    status,
};
