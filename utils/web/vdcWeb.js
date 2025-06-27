// TODO: Put this in vdc-common

async function updateMeilisearchPlayer(playerId) {
    console.log(`Updating Meilisearch player document for player id: ${playerId}`)
    try {
        const res = await fetch(`https://${process.env.VDC_WEB_URL}/api/meilisearch/player/${playerId}`);
        if (!res.ok) {
            console.warn("Unable to update Meilisearch player document.");
        }
    } catch (error) {
        console.warn("Unable to update Meilisearch player document.", error);
    }
	
}

module.exports = {
	updateMeilisearchPlayer,
};