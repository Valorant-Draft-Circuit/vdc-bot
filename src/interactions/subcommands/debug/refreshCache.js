const { ControlPanel } = require(`../../../../prisma`);
const fs = require(`fs`);
const { ChatInputCommandInteraction } = require(`discord.js`)

const { prisma } = require("../../../../prisma/prismadb");


async function refreshCache(/** @type ChatInputCommandInteraction */ interaction) {
    await interaction.editReply({ content: `🔃 Refreshing cache...` });
    await buildMMRCache();
    logger.log(`INFO`, `${interaction.user} (\`${interaction.user.username}\`) refreshed the cache`);
    return await interaction.editReply({ content: `✅ Cache refreshed!` });
}

module.exports = { refreshCache };

/** Query the database to get MMRs */
async function buildMMRCache() {
    const playerMMRs = await prisma.user.findMany({
        include: {
            Accounts: { where: { provider: `discord` } },
            PrimaryRiotAccount: { include: { MMR: true } },
            Status: true
        }
    });

    const mapped = playerMMRs.map((p) => {
        const disc = p.Accounts[0].providerAccountId;
        const mmr = p.PrimaryRiotAccount?.MMR?.mmrEffective;
        return { discordID: disc, mmr: mmr, ls: p.Status.leagueStatus, cs: p.Status.contractStatus};
    }).filter((p => p.mmr !== null && p.mmr !== undefined));

    const tierLines = await ControlPanel.getMMRCaps(`PLAYER`);

    fs.writeFileSync(`./cache/mmrCache.json`, JSON.stringify(mapped));
    fs.writeFileSync(`./cache/mmrTierLinesCache.json`, JSON.stringify({
        ...tierLines, pulled: new Date()
    }));
    return playerMMRs;
}