require(`dotenv`).config({ quiet: true });

const fs = require('fs');
const { Franchise, ControlPanel, MOD_TOOLS_EPOCH } = require(`../prisma`);
const { prisma } = require('../prisma/prismadb');
const { REST, Routes } = require('discord.js');

// this is needed to correctly sort the tiers
const tierSortWeights = {
    RECRUIT: 1,
    PROSPECT: 2,
    APPRENTICE: 3,
    EXPERT: 4,
    MYTHIC: 5
};

// #####################################################################################
// #####################################################################################
/** -- @main -- */

// run at startup
(async () => {
    await clearCache();
    await generateCache();
    await buildMMRCache();
    await buildCombineCountCache();
    await buildMuteCache();

    // agent emotes are cosmetic, so a valorant-api.com or Discord failure must not stop the bot from starting
    await emoteSync().catch((error) => console.log(`Skipped agent emote sync: ${error.message}`));
})();

// export functions if the bot needs to regenerate cache
module.exports = {
    clearCache: clearCache,
    generateCache: generateCache,
    buildMMRCache: buildMMRCache,
    buildCombineCountCache: buildCombineCountCache,
    buildMuteCache: buildMuteCache,
}

// #####################################################################################
// #####################################################################################
/** -- @functions -- */

/** Delete the cache */
async function clearCache() {
    const cacheFiles = fs.readdirSync(`./cache`).filter((f) => f.includes(`.json`));
    cacheFiles.forEach(file => fs.unlinkSync(`./cache/${file}`));
}

/** Query the database to generate the cache files */
async function generateCache() {
    // get all active franchises
    const franchiseCache = await Franchise.getAllActive();

    // create cache of all franchises
    const fc = franchiseCache.map((f) => { return { name: f.name, slug: f.slug } });
    const tc = franchiseCache.map((f) => f.Teams.filter((t) => t.active)
        .map((t) => { return { slug: f.slug, name: t.name, tier: t.tier } }))
        .flat().sort((a, b) => tierSortWeights[a.tier] - tierSortWeights[b.tier]);

    // build cache (write to internal files)
    fs.writeFileSync(`./cache/franchises.json`, JSON.stringify(fc));
    fs.writeFileSync(`./cache/teams.json`, JSON.stringify(tc));
}

/** Sync application emotes with discord for agents */
async function emoteSync() {

    // application emotes only need REST, so no gateway session (which would also keep this script alive)
    const rest = new REST().setToken(process.env.TOKEN);
    const { id: applicationID } = await rest.get(Routes.currentApplication());

    // fetch all existing application emotes
    const { items } = await rest.get(Routes.applicationEmojis(applicationID));
    const existingEmotes = items.map(e => e.name);

    const response = await fetch(`https://valorant-api.com/v1/agents?isPlayableCharacter=true`);
    if (!response.ok) throw new Error(`valorant-api.com responded with ${response.status}`);
    const activeAgents = await response.json();

    // create blank object to store data & sanatize name
    const agentData = {};
    const sanatizeName = (name) => name.toLowerCase().replace(/[^a-z]/, ``);
    activeAgents.data.map(a => agentData[sanatizeName(a.displayName)] = { name: sanatizeName(a.displayName), icon: a.displayIcon });

    // filter agents who already exist in the bot's emote list
    const filteredAgents = Object.keys(agentData).filter((agent) => { return existingEmotes.indexOf(agent) == -1; });

    // for every agent that doesn't exist, upload its icon (one bad icon shouldn't block the rest)
    for (let i = 0; i < filteredAgents.length; i++) {
        const agent = agentData[filteredAgents[i]];
        try {
            const image = await toDataURI(agent.icon);
            await rest.post(Routes.applicationEmojis(applicationID), { body: { name: agent.name, image: image } });
            console.log(`Added ${agent.name} as an emote from url: ${agent.icon}`);
        } catch (error) {
            console.log(`Failed to add ${agent.name} as an emote: ${error.message}`);
        }
    }
}

/** Download an image as the base64 data URI Discord expects for emote uploads */
async function toDataURI(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`downloading ${url} responded with ${response.status}`);

    const contentType = response.headers.get(`content-type`) ?? `image/png`;
    const base64 = Buffer.from(await response.arrayBuffer()).toString(`base64`);
    return `data:${contentType};base64,${base64}`;
}

/** Query the database to get MMRs */
async function buildMMRCache() {
    const playerMMRs = await prisma.user.findMany({
        include: {
            Accounts: { where: { provider: `discord` } },
            PrimaryRiotAccount: { include: { MMR: true } },
            Status: true
        }
    });

    const mapped = playerMMRs
        .filter((p) => p.Accounts.length > 0 && p.Status !== null)
        .map((p) => {
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

/** Build the active-mute cache (list of muted discordIDs) */
async function buildMuteCache() {
    const activeMutes = await prisma.modLogs.findMany({
        where: { type: `MUTE`, date: { gte: MOD_TOOLS_EPOCH }, OR: [{ expires: null }, { expires: { gt: new Date() } }] },
        select: { discordID: true },
        distinct: [`discordID`],
    });
    fs.writeFileSync(`./cache/muteCache.json`, JSON.stringify(activeMutes.map((m) => m.discordID)));
}
