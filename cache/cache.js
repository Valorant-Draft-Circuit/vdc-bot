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
    const ffc = franchiseCache.map((f) => { return { name: f.name, slug: f.slug } });
    fs.writeFileSync(`./cache/franchises.json`, JSON.stringify(ffc));
}
