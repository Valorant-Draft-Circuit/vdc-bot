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

function reasonMessage(result) {
	return REASON_MESSAGES[result.reason] ?? `I couldn't detect a match to submit.`;
}

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
	unrostered_players: `emergency sub not on a roster — verify before submitting`,
};

const SOFT_REVIEW_FLAGS = new Set([`unrostered_players`]);

function isSubmittable(game) {
	return game.flags.every((flag) => SOFT_REVIEW_FLAGS.has(flag));
}

function needsReview(game) {
	return game.flags.some((flag) => SOFT_REVIEW_FLAGS.has(flag));
}

function describeFlags(flags) {
	return flags.map((flag) => FLAG_LABELS[flag] ?? flag).join(`, `);
}

function formatMatchContext({ tier, matchType, matchDay, matchID }) {
	return [
		tier ? `Tier: \`${tier}\`` : null,
		matchType ? `Type: \`${matchType}\`` : null,
		matchDay ? `Matchday: \`${matchDay}\`` : null,
		matchID ? `Match: \`#${matchID}\`` : null,
	].filter(Boolean).join(` · `);
}

function annotatePlayers(players, unrostered) {
	const esubs = new Set(unrostered ?? []);
	return players.map((ign) => (esubs.has(ign) ? `${ign} (esub?)` : ign));
}

function buildGameFields(game, index, homeSide, awaySide) {
	const mapName = game.map ?? `Unknown map`;
	const headerValue = game.flags.length ? `⚠ ${describeFlags(game.flags)}` : `​`;

	return [
		{ name: `Game ${index + 1} · ${mapName}`, value: headerValue, inline: false },
		{ name: homeSide, value: annotatePlayers(game.home_players, game.unrostered).join(`\n`), inline: true },
		{ name: awaySide, value: annotatePlayers(game.away_players, game.unrostered).join(`\n`), inline: true },
	];
}

/**
 * Build the confirmation embed listing every detected game with its two sides.
 * @param {{ scheduledMatch: object, games: object[] }} result
 */
function buildCandidateEmbed(result) {
	const { scheduledMatch, games } = result;
	const submittable = games.filter(isSubmittable);
	const reviewCount = submittable.filter(needsReview).length;

	const context = formatMatchContext(scheduledMatch);

	const fields = games.flatMap((game, index) => buildGameFields(game, index, scheduledMatch.homeName, scheduledMatch.awayName));

	const summary = submittable.length
		? `I'll submit **${submittable.length}** game(s) on confirm${reviewCount ? ` (**${reviewCount}** need review — emergency sub)` : ``}. Review the lineups below.`
		: `Nothing new to submit here (already submitted or needs review).`;

	return new EmbedBuilder({
		author: { name: `VDC Match Submission` },
		title: `${scheduledMatch.homeName} vs ${scheduledMatch.awayName}`,
		description: [context, ``, summary].join(`\n`),
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
	isSubmittable,
	needsReview,
	annotatePlayers,
	iconURL,
};
