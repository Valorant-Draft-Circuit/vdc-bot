const { prisma } = require(`../../../prisma/prismadb`);

/** Runtime configuration for the scheduled-match auto-poller, stored in the ControlPanel table so
 * tech can enable it, opt matches in, and tune timings live without a redeploy. Rows are matched by
 * `name` (as getMMRCaps already does), so no ControlPanelID enum entry is needed. Missing rows fall
 * back to the defaults below, so the worker is safely idle until tech seeds and enables it.
 *
 * Seed these ControlPanel rows (name -> value):
 *   match_poller_enabled        "false"       on/off master switch
 *   match_poller_allowlist      ""            comma-separated matchIDs to act on (empty = none)
 *   match_poller_interval_ms    "300000"      sweep cadence (applied at boot; restart to change)
 *   match_poller_start_delay_ms "1200000"     wait after scheduled start before polling a match
 *   match_poller_giveup_ms      "21600000"    stop chasing an undecided match after this long
 */

const NAMES = {
	enabled: `match_poller_enabled`,
	allowlist: `match_poller_allowlist`,
	intervalMs: `match_poller_interval_ms`,
	startDelayMs: `match_poller_start_delay_ms`,
	giveupMs: `match_poller_giveup_ms`,
};

const DEFAULTS = {
	intervalMs: 5 * 60 * 1000,
	startDelayMs: 20 * 60 * 1000,
	giveupMs: 6 * 60 * 60 * 1000,
};

/** How long per-match Redis markers live. Internal, not tunable: longer than any giveup window so a
 * match's markers outlast its whole poll lifecycle and then self-expire. */
const STATE_TTL_SECONDS = 24 * 60 * 60;

function toPositiveMs(value, fallback) {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAllowlist(value) {
	const ids = (value ?? ``).split(`,`).map((entry) => Number(entry.trim())).filter((entry) => Number.isInteger(entry) && entry > 0);
	return new Set(ids);
}

/** Read the whole poller config in one ControlPanel query. Throws only on a DB failure (the sweep's
 * error handling retries next tick); missing rows just take their defaults. */
async function getPollerConfig() {
	const rows = await prisma.controlPanel.findMany({ where: { name: { in: Object.values(NAMES) } } });
	const valueOf = (name) => rows.find((row) => row.name === name)?.value;

	return {
		enabled: (/true/i).test(valueOf(NAMES.enabled) ?? ``),
		allowlist: parseAllowlist(valueOf(NAMES.allowlist)),
		intervalMs: toPositiveMs(valueOf(NAMES.intervalMs), DEFAULTS.intervalMs),
		startDelayMs: toPositiveMs(valueOf(NAMES.startDelayMs), DEFAULTS.startDelayMs),
		giveupMs: toPositiveMs(valueOf(NAMES.giveupMs), DEFAULTS.giveupMs),
	};
}

module.exports = { STATE_TTL_SECONDS, getPollerConfig };
