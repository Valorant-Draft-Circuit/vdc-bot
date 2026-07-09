const { Transaction } = require(`../../../prisma`);

/** When a substitute's stint ends, restore the player they replaced from SUBBED_OUT back
 * to SIGNED. The pairing is read from the newest SUB transaction for the sub on that team
 * (its details JSON carries `subbedOutID`). Transactions written before pairing existed
 * have no `subbedOutID`; in that case there is nothing to restore. The restore itself only
 * transitions SUBBED_OUT -> SIGNED, so a status an admin changed mid-window is left alone. */
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
