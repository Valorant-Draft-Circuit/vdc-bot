const { ControlPanel } = require(`../../../../prisma`);
const fs = require(`fs`);
const { ChatInputCommandInteraction } = require(`discord.js`)

const { prisma } = require("../../../../prisma/prismadb");


async function refreshCache(/** @type ChatInputCommandInteraction */ interaction) {
    await interaction.editReply({ content: `🔃 Refreshing cache...` });
    await buildMMRCache();
    await buildCombineCountCache();
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

async function buildCombineCountCache() {
    const currentSeason = await ControlPanel.getSeason();
    // Use Prisma native queries. First, group PlayerStats by userID to count distinct combine games
    // (Assumes one PlayerStats row per player per game, so counting rows == distinct games)
    const eligibleStatuses = [
        'DRAFT_ELIGIBLE',
        'FREE_AGENT',
        'RESTRICTED_FREE_AGENT',
        'SIGNED',
        'GENERAL_MANAGER'
    ];

    const counts = await prisma.playerStats.groupBy({
        by: ['userID'],
        where: {
            Game: { season: Number(currentSeason), gameType: 'COMBINE' },
            Player: { Status: { leagueStatus: { in: eligibleStatuses } } }
        },
        _count: { _all: true }
    });

    if (!counts || counts.length === 0) {
        fs.writeFileSync(`./cache/combineCountCache.json`, JSON.stringify([]));
        return [];
    }

    // Fetch corresponding discord providerAccountIds for these users
    const userIds = counts.map(c => c.userID);
    const accounts = await prisma.account.findMany({
        where: { provider: 'discord', userId: { in: userIds } },
        select: { providerAccountId: true, userId: true }
    });

    const accountMap = accounts.reduce((acc, a) => {
        acc[a.userId] = a.providerAccountId;
        return acc;
    }, {});

    const mapped = counts
        .map(c => ({ discordID: accountMap[c.userID], gameCount: Number(c._count._all) }))
        .filter(entry => entry.discordID !== undefined && entry.discordID !== null);

    fs.writeFileSync(`./cache/combineCountCache.json`, JSON.stringify(mapped));
    return mapped;
}