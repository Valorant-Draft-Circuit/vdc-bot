const fs = require('fs');
const { Franchise, ControlPanel } = require(`../prisma`);
const { prisma } = require('../prisma/prismadb');

// this is needed to correctly sort the tiers
const tierSortWeights = {
    PROSPECT: 1,
    APPRENTICE: 2,
    EXPERT: 3,
    MYTHIC: 4
};

// #####################################################################################
// #####################################################################################
/** -- @main -- */

// run at startup
(async () => {
    await clearCache();
    await generateCache();
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

/** Query the database to get MMRs */
async function buildMMRCache() {
    const playerMMRs = await prisma.user.findMany({
        include: {
            Accounts: { where: { provider: `discord` } },
            PrimaryRiotAccount: { include: { MMR: true } }
        }
    });

    const mapped = playerMMRs.map((p) => {
        const disc = p.Accounts[0].providerAccountId;
        const mmr = p.PrimaryRiotAccount?.MMR?.mmrEffective;
        return { discordID: disc, mmr: mmr }
    }).filter((p => p.mmr !== null && p.mmr !== undefined));

    const tierLines = await ControlPanel.getMMRCaps(`PLAYER`);

    fs.writeFileSync(`./cache/mmrCache.json`, JSON.stringify(mapped));
    fs.writeFileSync(`./cache/mmrTierLinesCache.json`, JSON.stringify({
        ...tierLines, pulled: new Date()
    }));
    return playerMMRs;
}