// TODO: Put this in vdc-common

async function updateMeilisearchPlayer(playerId) {
    logger.log(`DEBUG`, `Updating Meilisearch player document for player id: \`${playerId}\``);
    try {
        const res = await fetch(`https://${process.env.VDC_WEB_URL}/api/meilisearch/player/${playerId}?meiliauth=${process.env.MEILISEARCH_MASTER_KEY}`);
        if (!res.ok) {
            logger.log(`WARNING`, `Unable to update Meilisearch player document.`);
        }
    } catch (error) {
        logger.log(`WARNING`, `Unable to update Meilisearch player document. Error: ${error}`);
    }
}

module.exports = {
	updateMeilisearchPlayer,
};