// TODO: Put this in vdc-common

async function updateMeilisearchPlayer(playerId) {
    logger.log(`DEBUG`, `Updating Meilisearch player document for player id: \`${playerId}\``);
    try {
        const res = await fetch(`https://${process.env.VDC_WEB_URL}/api/meilisearch/player/${playerId}`);
        if (!res.ok) {
            logger.log(`WARN`, `Unable to update Meilisearch player document.`);
        }
    } catch (error) {
        logger.log(`WARN`, `Unable to update Meilisearch player document. Error: ${error}`);
    }
}

module.exports = {
	updateMeilisearchPlayer,
};