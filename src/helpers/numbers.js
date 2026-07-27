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
 * Submit a single game to the numbers service for processing.
 * @param {{ gameId: string, gameType: string, tier: string }} options
 */
async function submitGame(options) {
	const { gameId, gameType, tier } = options;

	return await fetch(`${NUMBERS_BASE_URL}/gameSubmit`, {
		method: `POST`,
		headers: { 'Content-Type': `application/json` },
		body: JSON.stringify({ game_id: gameId, game_type: gameType, tier: tier }),
	});
}

module.exports = { detectMatches, submitGame };
