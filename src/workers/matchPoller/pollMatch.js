const { GameType, ContractStatus } = require(`@prisma/client`);
const { Team } = require(`../../../prisma`);
const { detectMatches, submitGame } = require(`../../helpers/numbers`);
const { isSeriesDecided } = require(`./series`);
const { markPinged, wasPinged, markSubmitted, wasSubmitted, markDone, wasDone } = require(`./state`);
const { notifySuccess, notifyAnomaly, notifyGiveup } = require(`./notifications`);

const MAX_HOME_POLL_TARGETS = 5;
const ACTIVE_CONTRACT_STATUSES = [ContractStatus.SIGNED, ContractStatus.ACTIVE_SUB];

/** BO2 is regular season, BO3/BO5 are playoffs. Deriving the game type from the match's own type is
 * stable regardless of the current league state, which drifts over the poll window. */
function gameTypeFor(matchType) {
	return matchType === `BO2` ? GameType.SEASON : GameType.PLAYOFF;
}

const discordIdOf = (user) => user?.Accounts?.find((account) => account.provider === `discord`)?.providerAccountId ?? null;

/** Who to ask about the home team's game, in order: captain first, then active players (a subbed-in
 * player carries ACTIVE_SUB and maps to the right side). Bounded so a bad match can't fan out. */
async function orderedHomePollTargets(homeTeamId) {
	const { team, roster } = await Team.getRosterBy({ id: homeTeamId });
	const captain = roster.find((player) => player.id === team?.captain);
	const others = roster.filter((player) => player.id !== team?.captain && ACTIVE_CONTRACT_STATUSES.includes(player.Status?.contractStatus));

	const ordered = [captain, ...others].filter(Boolean);
	const discordIds = ordered.map(discordIdOf).filter(Boolean);
	return [...new Set(discordIds)].slice(0, MAX_HOME_POLL_TARGETS);
}

/** Submit every recommended game to the numbers service. Returns how many were newly submitted.
 * submitGame returns { completed, reason }: `completed` is a real new submit; a `game_exist` reason
 * means it was already recorded (e.g. a manual /submit beat us) and is not counted or warned. */
async function submitCleanGames(match, result) {
	let submitted = 0;
	for (const game of result.games) {
		const response = await submitGame({ gameId: game.game_id, gameType: gameTypeFor(match.matchType), tier: result.scheduledMatch.tier });
		if (response.completed) submitted += 1;
		else if (response.reason !== `game_exist`) logger.log(`WARNING`, `matchPoller: gameSubmit did not complete for game ${game.game_id} in match ${match.matchID} (${response.reason ?? `no reason`})`);
	}
	return submitted;
}

/** Poll one candidate match: finalize it if the series is decided or the window elapsed, otherwise
 * ask the home side for their games and auto-submit a clean detection. All actions are idempotent
 * and one-shot via the Redis markers, so re-running each tick is safe. */
async function pollMatch(client, match, { now, startDelayMs, giveupMs }) {
	if (await wasDone(match.matchID)) return;

	if (isSeriesDecided(match.matchType, match.Games)) {
		if (await wasSubmitted(match.matchID)) {
			await notifySuccess(client, match);
			logger.log(`INFO`, `matchPoller: match ${match.matchID} complete (auto-submitted), stopping`);
		} else {
			logger.log(`INFO`, `matchPoller: match ${match.matchID} complete (submitted elsewhere), stopping`);
		}
		return markDone(match.matchID);
	}

	const age = now - match.dateScheduled.getTime();

	if (age > giveupMs) {
		if (!(await wasPinged(match.matchID))) {
			await notifyGiveup(client, match);
			await markPinged(match.matchID);
		}
		logger.log(`INFO`, `matchPoller: match ${match.matchID} gave up after the poll window, stopping`);
		return markDone(match.matchID);
	}

	if (age < startDelayMs) return;

	const pollTargets = await orderedHomePollTargets(match.home);

	for (const discordUserId of pollTargets) {
		let result;
		try {
			result = await detectMatches({ discordUserId });
		} catch (error) {
			logger.log(`WARNING`, `matchPoller: detect unavailable for match ${match.matchID}, retrying next tick`, error.stack);
			return;
		}

		if (result.reason) {
			if (result.reason === `already_submitted`) return;
			continue;
		}

		if (!result.scheduledMatch) continue;
		if (result.scheduledMatch.matchID !== match.matchID) return;

		const clean = result.games.length > 0 && result.games.every((game) => game.recommended);
		if (!clean) {
			if (!(await wasPinged(match.matchID))) {
				await notifyAnomaly(client, match);
				await markPinged(match.matchID);
				logger.log(`INFO`, `matchPoller: match ${match.matchID} has games needing review, pinged home GM`);
			}
			return;
		}

		const submitted = await submitCleanGames(match, result);
		if (submitted > 0) {
			await markSubmitted(match.matchID);
			logger.log(`INFO`, `matchPoller: auto-submitted ${submitted} game(s) for match ${match.matchID}`);
		}
		return;
	}
}

module.exports = { pollMatch };
