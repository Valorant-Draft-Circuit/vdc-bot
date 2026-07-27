const { EmbedBuilder } = require(`discord.js`);
const { Team, Franchise } = require(`../../../prisma`);
const { iconURL, formatMatchContext } = require(`../../helpers/submitDetect`);

/** A user's Discord id lives on their `discord` provider Account row; a user may have none. */
function discordIdOf(user) {
	return user?.Accounts?.find((account) => account.provider === `discord`)?.providerAccountId ?? null;
}

async function homeGMDiscordId(homeTeamId) {
	const franchise = await Franchise.getBy({ teamID: homeTeamId });
	return discordIdOf(franchise?.GM);
}

async function captainDiscordId(teamId) {
	const { team, roster } = await Team.getRosterBy({ id: teamId });
	if (!team?.captain) return null;
	const captain = roster.find((player) => player.id === team.captain);
	return discordIdOf(captain);
}

/** DM a single user, tolerating a user who has closed DMs or can't be fetched. */
async function dmUser(client, discordId, embed, contextLabel) {
	if (!discordId) return false;
	try {
		const user = await client.users.fetch(discordId);
		await user.send({ embeds: [embed] });
		return true;
	} catch (error) {
		logger.log(`WARNING`, `matchPoller: could not DM ${contextLabel} (${discordId})`, error.stack);
		return false;
	}
}

function teamNameFor(match, teamId) {
	if (teamId === match.home) return match.Home?.name ?? `Team ${teamId}`;
	if (teamId === match.away) return match.Away?.name ?? `Team ${teamId}`;
	return teamId ? `Team ${teamId}` : `TBD`;
}

/** One line per game: map and the winner (from Games.winner), for the completion summary. */
function describeGames(match) {
	return match.Games
		.map((game, index) => {
			const winner = game.winner ? teamNameFor(match, game.winner) : `result pending`;
			return `Game ${index + 1} · ${game.map ?? `Unknown map`} — ${winner}`;
		})
		.join(`\n`);
}

function matchContext(match) {
	return formatMatchContext({ tier: match.tier, matchType: match.matchType, matchDay: match.matchDay, matchID: match.matchID });
}

/** The poller finished a series on its own. Post one confirmation to #submitted-games and DM both
 * captains a per-game summary. */
async function notifySuccess(client, match) {
	const homeName = match.Home?.name ?? `Team ${match.home}`;
	const awayName = match.Away?.name ?? `Team ${match.away}`;

	logger.matchdrain(`<t:${Math.round(Date.now() / 1000)}:d> <t:${Math.round(Date.now() / 1000)}:T> **Auto-submitted** - \`${homeName} vs ${awayName}\`, Matchday \`${match.matchDay}\`, Match \`#${match.matchID}\``);

	const embed = new EmbedBuilder({
		author: { name: `VDC Match Submission` },
		title: `${homeName} vs ${awayName}`,
		description: [matchContext(match), ``, `Your match was auto-submitted. Results:`, describeGames(match)].join(`\n`),
		thumbnail: { url: iconURL },
		color: 0xE92929,
		footer: { text: `Valorant Draft Circuit — Match Result Submissions (auto)` },
	});

	const [homeCaptain, awayCaptain] = await Promise.all([captainDiscordId(match.home), captainDiscordId(match.away)]);
	await dmUser(client, homeCaptain, embed, `home captain of match ${match.matchID}`);
	await dmUser(client, awayCaptain, embed, `away captain of match ${match.matchID}`);
}

function gmEmbed(match, description) {
	const homeName = match.Home?.name ?? `Team ${match.home}`;
	const awayName = match.Away?.name ?? `Team ${match.away}`;
	return new EmbedBuilder({
		author: { name: `VDC Match Submission` },
		title: `${homeName} vs ${awayName}`,
		description: [matchContext(match), ``, description].join(`\n`),
		thumbnail: { url: iconURL },
		color: 0xE9A129,
		footer: { text: `Valorant Draft Circuit — Match Result Submissions (auto)` },
	});
}

/** A detection surfaced games that need a human (off-veto / duplicate / over-cap). Ask the home GM
 * to submit manually. */
async function notifyAnomaly(client, match) {
	const embed = gmEmbed(match, `I found a game for this match that needs review before it can be submitted. Please run \`/submit\` to check it over.`);
	await dmUser(client, await homeGMDiscordId(match.home), embed, `home GM of match ${match.matchID}`);
}

/** The poll window elapsed with the series still undecided. Tell the home GM the auto-path gave up. */
async function notifyGiveup(client, match) {
	const embed = gmEmbed(match, `I couldn't auto-submit this match within its scheduled window. If it was rescheduled, \`/reschedule\` it and it will auto-detect again, or run \`/submit\` to submit it now.`);
	await dmUser(client, await homeGMDiscordId(match.home), embed, `home GM of match ${match.matchID}`);
}

module.exports = { notifySuccess, notifyAnomaly, notifyGiveup };
