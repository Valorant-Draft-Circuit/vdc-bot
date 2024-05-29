const fs = require('fs');
const { Franchise } = require(`../prisma`);

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
})();

// export functions if the bot needs to regenerate cache
module.exports = {
    clearCache: clearCache,
    generateCache: generateCache
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
