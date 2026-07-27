const { Client } = require(`discord.js`);
const { sweep } = require(`./sweep`);
const { getPollerConfig } = require(`./config`);

const FALLBACK_INTERVAL_MS = 5 * 60 * 1000;

let isSweeping = false;

/** Run one sweep, skipping if the previous one is still in flight so a slow sweep can't overlap the
 * next tick and double-process a match. */
async function runSweep(client, failureLabel) {
	if (isSweeping) return;
	isSweeping = true;
	try {
		await sweep(client);
	} catch (error) {
		logger.log(`ERROR`, failureLabel, error.stack);
	} finally {
		isSweeping = false;
	}
}

/** Start the scheduled-match auto-poller: a boot sweep plus a periodic sweep. The interval is fixed
 * at boot; enable/allowlist/timings are read from ControlPanel each sweep, so the worker always runs
 * and simply idles until tech turns it on.
 * @param {Client} client
 */
async function startMatchPoller(client) {
	let intervalMs = FALLBACK_INTERVAL_MS;
	try {
		({ intervalMs } = await getPollerConfig());
	} catch (error) {
		logger.log(`ERROR`, `matchPoller: could not read config at boot, using default interval`, error.stack);
	}

	await runSweep(client, `Boot match-poll sweep failed`);

	setInterval(() => runSweep(client, `Match-poll sweep failed`), intervalMs);

	logger.log(`INFO`, `Match poller started (${Math.round(intervalMs / 60000)}m sweep, gated on ControlPanel)`);
}

module.exports = { startMatchPoller };
