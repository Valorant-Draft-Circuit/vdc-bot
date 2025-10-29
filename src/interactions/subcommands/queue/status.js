const { MessageFlags, EmbedBuilder } = require(`discord.js`);
const { getRedisClient } = require(`../../../core/redis`);

async function status(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const redis = getRedisClient();
    try {
        const tiers = await redis.smembers(`vdc:tiers`);
        if (!Array.isArray(tiers) || tiers.length === 0) {
            return interaction.editReply({ content: `No tiers are currently registered.` });
        }

        const rows = [];

        // Build base tier queue counts
        for (const tier of tiers) {
            if (!tier) continue;

            const listKeys = [
                `vdc:tier:${tier}:queue:DE`,
                `vdc:tier:${tier}:queue:FA`,
                `vdc:tier:${tier}:queue:RFA`,
                `vdc:tier:${tier}:queue:SIGNED`,
                `vdc:tier:${tier}:queue:DE:completed`,
                `vdc:tier:${tier}:queue:FA:completed`,
                `vdc:tier:${tier}:queue:RFA:completed`,
                `vdc:tier:${tier}:queue:SIGNED:completed`,
            ];

            // run LLEN for each list and sum
            const counts = await Promise.all(listKeys.map((k) => redis.llen(k).catch(() => 0)));
            const sum = counts.reduce((acc, v) => acc + (Number(v) || 0), 0);
            rows.push({ tier, queued: sum, ongoingMatches: 0 });
        }

        // Count ongoing matches per tier by scanning vdc:match:* keys and reading their 'tier' and 'status' fields.
        try {
            let cursor = `0`;
            const matchKeys = [];
            do {
                const [nextCursor, results] = await redis.scan(cursor, `MATCH`, `vdc:match:*`, `COUNT`, 250);
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
