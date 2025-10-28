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
            rows.push({ tier, count: sum });
        }

        // Sort tiers alphabetically for stable output
        rows.sort((a, b) => String(a.tier).localeCompare(String(b.tier)));

        const embed = new EmbedBuilder()
            .setTitle(`Queue Status — Tier Counts`)
            .setColor(0x5865F2);

        for (const r of rows) {
            embed.addFields({ name: `${r.tier}`, value: `${r.count}`, inline: true });
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
