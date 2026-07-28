const NUMBERS_BASE_URL = process.env.NUMBERS_BASE_URL ?? `https://numbers.vdc.gg`;

/**
 * Ask the numbers service to find the custom game(s) a player just played, without a tracker.gg
 * link. Pass combinePlayers (the queue lobby's discord ids) to detect a combine game instead of
 * a scheduled season/playoff match. Returns the parsed detect payload: { reason, scheduledMatch, games }.
 * @param {{ discordUserId: string, combinePlayers?: string[] }} options
 */
async function detectMatches(options) {
	const { discordUserId, combinePlayers } = options;

	const body = { discord_user_id: discordUserId };
	if (combinePlayers) body.combine_players = combinePlayers;

	const response = await fetch(`${NUMBERS_BASE_URL}/matches/detect`, {
		method: `POST`,
		headers: { 'Content-Type': `application/json` },
		body: JSON.stringify(body),
	});

	if (!response.ok) throw new Error(`Numbers detect request failed with status ${response.status}`);
	return await response.json();
}

/**
 * Submit a single game to the numbers service for processing. The service replies HTTP 200 even for
 * rejections, distinguishing outcome in the body, so this returns the parsed classification rather
 * than a raw response: `completed` is true only on a real submit; `reason` carries the rejection
 * reason (e.g. `game_exist` when the game was already recorded).
 * @param {{ gameId: string, gameType: string, tier: string }} options
 * @returns {Promise<{ httpOk: boolean, completed: boolean, reason: ?string }>}
 */
async function submitGame(options) {
	const { gameId, gameType, tier } = options;

	const response = await fetch(`${NUMBERS_BASE_URL}/gameSubmit`, {
		method: `POST`,
		headers: { 'Content-Type': `application/json` },
		body: JSON.stringify({ game_id: gameId, game_type: gameType, tier: tier }),
	});

	let body = {};
	try {
		body = await response.json();
	} catch {
		body = {};
	}

	return { httpOk: response.ok, completed: body.completed === true, reason: body.reason ?? null };
}

module.exports = { detectMatches, submitGame };
