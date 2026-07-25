const { Client } = require(`discord.js`);
const { reconcileExpiredSubs } = require(`./reconcile`);
const { GUILD } = require(`../../../utils/enums`);

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

let isReconciling = false;

/** Run one reconciliation pass, skipping if a previous pass is still in flight so
 * a slow sweep can't overlap the next interval tick and double-unsub. */
async function runReconcile(client, failureLabel) {
	if (isReconciling) return;
	isReconciling = true;
	try {
		const guild = await client.guilds.fetch(GUILD).catch(() => null);
		if (guild) await reconcileExpiredSubs(guild);
	} catch (error) {
		logger.log(`ERROR`, failureLabel, error.stack);
	} finally {
		isReconciling = false;
	}
}

/** Boot pass plus periodic sweep that ends elapsed active subs, replacing the old
 * in-process setTimeout so pending auto-unsubs survive restarts.
 * @param {Client} client
 */
async function startSubExpiry(client) {
	await runReconcile(client, `Boot sub-expiry reconciliation failed`);

	setInterval(() => runReconcile(client, `Sub-expiry reconciliation failed`), RECONCILE_INTERVAL_MS);

	logger.log(`INFO`, `Sub expiry runtime started (${RECONCILE_INTERVAL_MS / 60000}m reconciliation)`);
}

module.exports = { startSubExpiry };
