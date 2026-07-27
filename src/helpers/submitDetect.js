const { EmbedBuilder } = require(`discord.js`);

const DETECT_STATE_TTL_SECONDS = 600;
const iconURL = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/vdc-logos/champwall.png`;

const REASON_MESSAGES = {
	no_riot_account: `I couldn't find a linked Riot account for you. Link your account or open a tech ticket.`,
	no_team: `You don't appear to be on a team, so I can't match your games to a scheduled match.`,
	matchlist_unavailable: `I couldn't reach Riot's servers to look up your recent matches. Please try again shortly.`,
	no_custom_found: `I couldn't find a recent custom game for you. Play your match first, or submit with a tracker.gg link.`,
	no_scheduled_match: `I found recent customs but none matched a scheduled match for your team. Double check the lineup, or submit with a tracker.gg link.`,
	no_combine_match: `I couldn't find a recent custom that matches your combine lobby. Play your match first, or submit with a tracker.gg link.`,
	already_submitted: `Looks like your recent match games were already submitted!`,
};

function detectStateKey(messageId) {
	return `submitdetect:${messageId}`;
}

/** The user-facing message for a detect result's reason (plain text; used for reasons that have
 * nothing to link). already_submitted is rendered as an embed via buildAlreadySubmittedEmbed. */
function reasonMessage(result) {
	return REASON_MESSAGES[result.reason] ?? `I couldn't detect a match to submit.`;
}

/** Embed for an already-submitted result: the match (linked to vdc.gg) with each game listed and
 * hyperlinked to its vdc.gg game view. Combines have no match page, so their game falls back to
 * tracker.gg. Embeds render markdown links; plain content doesn't. */
function buildAlreadySubmittedEmbed(result) {
	const lines = [REASON_MESSAGES.already_submitted];
	if (result.matchID) {
		const context = [
			result.homeName && result.awayName ? `${result.homeName} vs ${result.awayName}` : null,
			result.matchDay ? `Matchday ${result.matchDay}` : null,
			result.tier,
		].filter(Boolean).join(` · `);
		lines.push(`Match: [#${result.matchID}](https://vdc.gg/match/${result.matchID})${context ? ` · ${context}` : ``}`);
		result.games.forEach((game, index) => {
			lines.push(`[Game ${index + 1}](https://vdc.gg/match/${result.matchID}?game=${game.game_id})`);
		});
	} else {
		result.games.forEach((game, index) => {
			lines.push(`[Game ${index + 1}](https://tracker.gg/valorant/match/${game.game_id})`);
		});
	}

	return new EmbedBuilder({
		author: { name: `VDC Match Submission` },
		description: lines.join(`\n`),
		thumbnail: { url: iconURL },
		color: 0xE9A129,
		footer: { text: `Valorant Draft Circuit — Match Result Submissions` },
	});
}

const FLAG_LABELS = {
	over_cap: `extra game beyond series length`,
	off_veto_map: `map not in the veto`,
	duplicate_map: `map already played`,
};

function describeFlags(flags) {
	return flags.map((flag) => FLAG_LABELS[flag] ?? flag).join(`, `);
}

/** The one-line match context (tier · type · matchday · match #), omitting any part that's absent
 * (e.g. combines have no matchType/matchDay/matchID). */
function formatMatchContext({ tier, matchType, matchDay, matchID }) {
	return [
		tier ? `Tier: \`${tier}\`` : null,
		matchType ? `Type: \`${matchType}\`` : null,
		matchDay ? `Matchday: \`${matchDay}\`` : null,
		matchID ? `Match: \`#${matchID}\`` : null,
	].filter(Boolean).join(` · `);
}

/** A game renders as three fields: a full-width header (map + any warning) then the two teams
 * as side-by-side inline columns, one player per line. */
function buildGameFields(game, index, homeSide, awaySide) {
	const mapName = game.map ?? `Unknown map`;
	const headerValue = game.flags.length ? `⚠ ${describeFlags(game.flags)}` : `​`;

	return [
		{ name: `Game ${index + 1} · ${mapName}`, value: headerValue, inline: false },
		{ name: homeSide, value: game.home_players.join(`\n`), inline: true },
		{ name: awaySide, value: game.away_players.join(`\n`), inline: true },
	];
}

/**
 * Build the confirmation embed listing every detected game with its two sides.
 * @param {{ scheduledMatch: object, games: object[] }} result
 */
function buildCandidateEmbed(result) {
	const { scheduledMatch, games } = result;
	const recommendedCount = games.filter((game) => game.recommended).length;

	const context = formatMatchContext(scheduledMatch);

	const fields = games.flatMap((game, index) => buildGameFields(game, index, scheduledMatch.homeName, scheduledMatch.awayName));

	return new EmbedBuilder({
		author: { name: `VDC Match Submission` },
		title: `${scheduledMatch.homeName} vs ${scheduledMatch.awayName}`,
		description: [
			context,
			``,
			recommendedCount
				? `I'll submit **${recommendedCount}** game(s) on confirm. Review the lineups below.`
				: `Nothing new to submit here (already submitted or needs review).`,
		].join(`\n`),
		thumbnail: { url: iconURL },
		color: 0xE92929,
		fields,
		footer: { text: `Valorant Draft Circuit — Match Result Submissions` },
	});
}

/**
 * Build the confirmation embed for a single combine game (no scheduled teams; the queue lobby
 * is the two sides from the custom).
 * @param {{ map: string, red_players: string[], blue_players: string[] }} game
 */
function buildCombineCandidateEmbed(game, tier) {
	const mapName = game.map ?? `Unknown map`;
	const context = formatMatchContext({ tier });

	return new EmbedBuilder({
		author: { name: `VDC Match Submission` },
		title: `Combine Match`,
		description: [context, ``, `I'll submit this combine game on confirm. Review the lineup below.`]
			.filter((line) => line !== ``)
			.join(`\n\n`),
		thumbnail: { url: iconURL },
		color: 0xE92929,
		fields: [
			{ name: `Combine · ${mapName}`, value: `​`, inline: false },
			{ name: `Red`, value: game.red_players.join(`\n`), inline: true },
			{ name: `Blue`, value: game.blue_players.join(`\n`), inline: true },
		],
		footer: { text: `Valorant Draft Circuit — Match Result Submissions` },
	});
}

module.exports = {
	DETECT_STATE_TTL_SECONDS,
	REASON_MESSAGES,
	reasonMessage,
	buildAlreadySubmittedEmbed,
	formatMatchContext,
	detectStateKey,
	buildCandidateEmbed,
	buildCombineCandidateEmbed,
	iconURL,
};
