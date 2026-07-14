const { Transaction } = require(`../../../prisma`);

async function restorePairedSubbedOutPlayer(subUserID, teamID) {
	const latestSubTransaction = await Transaction.getLatestSub({ userID: subUserID, teamID: teamID });
	const subbedOutID = parseSubbedOutID(latestSubTransaction?.details);
	if (subbedOutID == null) return;

	await Transaction.restoreSubbedOut(subbedOutID);
}

function parseSubbedOutID(details) {
	if (details == null) return null;

	try {
		return JSON.parse(details).subbedOutID ?? null;
	} catch {
		return null;
	}
}

module.exports = { restorePairedSubbedOutPlayer };
