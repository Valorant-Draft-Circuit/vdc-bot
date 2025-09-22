const fs = require('fs');
const { Franchise, ControlPanel } = require(`../prisma`);
const { prisma } = require('../prisma/prismadb');
const { Client, Application } = require('discord.js');

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
    await emoteSync();
    await buildMMRCache();
})();

// export functions if the bot needs to regenerate cache
module.exports = {
    clearCache: clearCache,
    generateCache: generateCache,
    buildMMRCache: buildMMRCache,
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

    // login to discord with client token
    const client = new Client({ intents: [] });
    await client.login(process.env.TOKEN);

    // fetch all existing application emotes
    const existingEmotes = (await client.application.emojis.fetch()).map(e => e.name);

    // 
    const response = await fetch(`https://valorant-api.com/v1/agents?isPlayableCharacter=true`);
    if (!response.ok) return console.log(`There was an error fetching agent data!`)
    const activeAgents = await response.json();

    // create blank object to store data & sanatize name
    const agentData = {};
    const sanatizeName = (name) => name.toLowerCase().replace(/[^a-z]/, ``);
    activeAgents.data.map(a => agentData[sanatizeName(a.displayName)] = { name: sanatizeName(a.displayName), icon: a.displayIcon });

    // filter agents who already exist in the bot's emote list
    const filteredAgents = Object.keys(agentData).filter((agent) => { return existingEmotes.indexOf(agent) == -1; });

    // for every agent that doesn't exist, 
    for (let i = 0; i < filteredAgents.length; i++) {
        const agent = agentData[filteredAgents[i]];
        await client.application.emojis.create({ attachment: agent.icon, name: agent.name });
        console.log(`Added ${agent.name} as an emote from url: ${agent.icon}`);
    }

    // destroy the client instance
    client.destroy();
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
