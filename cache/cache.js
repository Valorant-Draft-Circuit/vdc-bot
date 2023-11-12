const fs = require('fs');
const { Franchise } = require(`../prisma`);


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
    const franchiseCache = await Franchise.getAllActive();
    const fc = franchiseCache.map((f) => { return { name: f.name, slug: f.slug } });
    const tc = franchiseCache.map((f) => f.Team.filter((t) => t.isActive).map((t) => { return { slug: f.slug, name: t.name } })).flat();
    fs.writeFileSync(`./cache/franchises.json`, JSON.stringify(fc));
    fs.writeFileSync(`./cache/teams.json`, JSON.stringify(tc));
}
