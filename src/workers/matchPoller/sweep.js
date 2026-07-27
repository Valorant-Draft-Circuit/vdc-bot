const { MatchType } = require(`@prisma/client`);
const { ControlPanel } = require(`../../../prisma`);
const { prisma } = require(`../../../prisma/prismadb`);
const { getPollerConfig } = require(`./config`);
const { pollMatch } = require(`./pollMatch`);

const POLLABLE_MATCH_TYPES = [MatchType.BO2, MatchType.BO3, MatchType.BO5];

/** Candidate matches this sweep: allowlisted, this season, already started (>= start delay ago) and
 * not yet aged out of the giveup window. The lower bound keeps one sweep of grace past giveup so a
 * match's give-up transition is caught before it drops out of the query. */
async function findCandidateMatches({ season, allowlist, now, startDelayMs, giveupMs, intervalMs }) {
	return prisma.matches.findMany({
		where: {
			season: season,
			matchType: { in: POLLABLE_MATCH_TYPES },
			matchID: { in: [...allowlist] },
			dateScheduled: {
				lte: new Date(now - startDelayMs),
				gte: new Date(now - (giveupMs + intervalMs)),
			},
		},
		include: { Games: { orderBy: { datePlayed: `asc` } }, Home: true, Away: true },
		orderBy: { dateScheduled: `asc` },
	});
}

/** One poll sweep: read live config, find the candidate matches, and poll each in turn. Idle when
 * the feature is off or nothing is allowlisted. */
async function sweep(client) {
	const config = await getPollerConfig();
	if (!config.enabled || config.allowlist.size === 0) return;

	const season = await ControlPanel.getSeason();
	const now = Date.now();

	const matches = await findCandidateMatches({ season, ...config, now });
	if (matches.length === 0) return;

	logger.log(`INFO`, `matchPoller: polling ${matches.length} match(es): ${matches.map((match) => match.matchID).join(`, `)}`);

	for (const match of matches) {
		await pollMatch(client, match, { now, startDelayMs: config.startDelayMs, giveupMs: config.giveupMs });
	}
}

module.exports = { sweep };
