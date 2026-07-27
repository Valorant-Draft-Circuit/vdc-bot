/** Pure series-completion logic, mirroring VDCNumbersPython GamesTable.get_match_id so the poller
 * stops polling exactly when the numbers service considers a series over. A series is decided when
 * every map has been played (the cap) or a team has clinched the majority early. BO2 has no early
 * clinch: both maps always play and it can end 1-1. */

const SERIES_CAP = { BO2: 2, BO3: 3, BO5: 5 };
const SERIES_CLINCH = { BO3: 2, BO5: 3 };

/** Tally game wins per team id from the match's games, ignoring games the numbers service has not
 * scored yet (null winner). */
function countWins(games) {
	const winsByTeam = new Map();
	for (const game of games) {
		if (game.winner === null || game.winner === undefined) continue;
		winsByTeam.set(game.winner, (winsByTeam.get(game.winner) ?? 0) + 1);
	}
	return winsByTeam;
}

/** Whether the series for a scheduled match is over and should no longer be polled.
 * @param {string} matchType one of BO2 / BO3 / BO5
 * @param {{ winner: ?number }[]} games the match's Games rows
 */
function isSeriesDecided(matchType, games) {
	const cap = SERIES_CAP[matchType];
	if (cap === undefined) return false;

	if (games.length >= cap) return true;

	const clinch = SERIES_CLINCH[matchType];
	if (clinch === undefined) return false;

	const winsByTeam = countWins(games);
	for (const wins of winsByTeam.values()) {
		if (wins >= clinch) return true;
	}
	return false;
}

module.exports = { SERIES_CAP, SERIES_CLINCH, countWins, isSeriesDecided };
