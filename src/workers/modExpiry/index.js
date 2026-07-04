const { Client } = require(`discord.js`);
const { startExpirySubscriber } = require(`./subscriber`);
const { reconcileOnce } = require(`./reconcile`);
const { GUILD } = require(`../../../utils/enums`);

const RECONCILE_INTERVAL_MS = 60 * 60 * 1000;

/** Start the mod expiry runtime: real-time subscriber + boot/hourly safety net.
 * @param {Client} client
 */
async function startModExpiry(client) {
	await startExpirySubscriber(client);

	const guild = await client.guilds.fetch(GUILD).catch(() => null);
	if (guild) await reconcileOnce(guild).catch((error) => logger.log(`ERROR`, `Boot reconciliation failed`, error.stack));

	setInterval(async () => {
		const intervalGuild = await client.guilds.fetch(GUILD).catch(() => null);
		if (intervalGuild) await reconcileOnce(intervalGuild).catch((error) => logger.log(`ERROR`, `Hourly reconciliation failed`, error.stack));
	}, RECONCILE_INTERVAL_MS);

	logger.log(`INFO`, `Mod expiry runtime started (subscriber + hourly reconciliation)`);
}

module.exports = { startModExpiry };
