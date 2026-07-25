const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } = require(`discord.js`);
const { Team, Player } = require(`../../../../prisma`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { LeagueNavigationOptions } = require(`../../../../utils/enums`);
const { tierLabel } = require(`../../../helpers/transactions/formatTeam`);
const { awardAccoladeIfAbsent } = require(`../../../helpers/league/accolades`);

// game wins needed to clinch a series by match format (grand finals are BO5, or BO3 if downgraded)
const GAMES_TO_CLINCH = { BO2: 2, BO3: 2, BO5: 3 };

function discordIdFromAccounts(accounts) {
	return accounts?.find((account) => account.provider === `discord`)?.providerAccountId ?? null;
}

function formatRecipients(recipients) {
	if (recipients.length === 0) return `*none*`;
	return recipients.map((r) => (r.discordID ? `<@${r.discordID}>` : `\`${r.userID}\``)).join(`, `);
}

/** Derive everyone owed a championship accolade from a single final's match id.
 * Returns { error } for any refusal, otherwise the champion + recipient groups.
 * Deterministic so the confirm handler can re-run it from the stashed match id. */
async function deriveChampionshipAwards(matchId) {
	const match = await prisma.matches.findUnique({
		where: { matchID: matchId },
		include: { Games: { include: { PlayerStats: true } } },
	});
	if (match == null) return { error: `Match \`#${matchId}\` was not found.` };

	const winsToClinch = GAMES_TO_CLINCH[match.matchType];
	if (winsToClinch == null) return { error: `Match \`#${matchId}\` is a \`${match.matchType}\`, which is not a grand-final format.` };

	const winsByTeam = new Map();
	for (const game of match.Games) {
		if (game.winner == null) continue;
		winsByTeam.set(game.winner, (winsByTeam.get(game.winner) ?? 0) + 1);
	}

	let winningTeamID = null;
	for (const [teamID, wins] of winsByTeam) {
		if (wins >= winsToClinch) winningTeamID = teamID;
	}
	if (winningTeamID == null) return { error: `The final for match \`#${matchId}\` is not complete or processed yet (no team has clinched).` };

	const team = await Team.getBy({ id: winningTeamID });
	if (team == null) return { error: `The winning team (id \`${winningTeamID}\`) for match \`#${matchId}\` could not be loaded.` };

	const franchise = await prisma.franchise.findUnique({
		where: { id: team.franchise },
		include: {
			GM: { include: { Accounts: true } },
			AGM1: { include: { Accounts: true } },
			AGM2: { include: { Accounts: true } },
			AGM3: { include: { Accounts: true } },
			AGM4: { include: { Accounts: true } },
		},
	});

	const winRecipients = team.Roster.map((player) => ({
		userID: player.id,
		discordID: discordIdFromAccounts(player.Accounts),
	}));

	const fmMembers = [franchise?.GM, franchise?.AGM1, franchise?.AGM2, franchise?.AGM3, franchise?.AGM4].filter((member) => member != null);
	const fmRecipients = fmMembers.map((member) => ({
		userID: member.id,
		discordID: discordIdFromAccounts(member.Accounts),
	}));

	const rosterIDs = new Set(winRecipients.map((recipient) => recipient.userID));
	const subIDs = new Set();
	for (const game of match.Games) {
		for (const stat of game.PlayerStats) {
			if (stat.team === winningTeamID && stat.userID != null && !rosterIDs.has(stat.userID)) subIDs.add(stat.userID);
		}
	}
	const subRecipients = await Promise.all([...subIDs].map(async (userID) => {
		const player = await Player.getBy({ userID: userID });
		return { userID: userID, discordID: discordIdFromAccounts(player?.Accounts) };
	}));

	return { season: match.season, tier: match.tier, teamName: team.name, winRecipients, fmRecipients, subRecipients };
}

/** Preview the derived championship awards behind a confirmation button.
 * @param {ChatInputCommandInteraction} interaction
 */
async function requestAwardFinal(interaction) {
	const matchId = interaction.options._hoistedOptions.find((option) => option.name === `match-id`).value;

	const derived = await deriveChampionshipAwards(matchId);
	if (derived.error != null) return await interaction.editReply(derived.error);

	const { season, tier, teamName, winRecipients, fmRecipients, subRecipients } = derived;

	const embed = new EmbedBuilder({
		author: { name: `VDC League Manager` },
		description: `Award **Season ${season} ${tierLabel(tier)}** championship accolades to **${teamName}**?`,
		color: 0xe92929,
		fields: [
			{ name: `🏆 Winner (${winRecipients.length})`, value: formatRecipients(winRecipients) },
			{ name: `👑 Franchise Management (${fmRecipients.length})`, value: formatRecipients(fmRecipients) },
			{ name: `🥈 Substitute(s) (${subRecipients.length})`, value: formatRecipients(subRecipients) },
			{ name: `Match`, value: `#${matchId}` },
		],
		footer: { text: `League — Award Final` },
	});

	const cancel = new ButtonBuilder({ customId: `league_${LeagueNavigationOptions.CANCEL}`, label: `Cancel`, style: ButtonStyle.Danger });
	const confirm = new ButtonBuilder({ customId: `league_${LeagueNavigationOptions.AWARD_FINAL_CONFIRM}`, label: `Confirm`, style: ButtonStyle.Success });
	const row = new ActionRowBuilder({ components: [cancel, confirm] });

	return await interaction.editReply({ embeds: [embed], components: [row] });
}

/** Award the accolades on confirm, re-deriving from the stashed match id so the
 * write reflects current DB state, then report created vs already-present.
 * @param {ChatInputCommandInteraction} interaction
 */
async function confirmAwardFinal(interaction) {
	const embed = interaction.message.embeds[0];
	const matchField = embed.fields.find((field) => field.name === `Match`);
	const matchId = Number(matchField.value.replace(`#`, ``));

	const derived = await deriveChampionshipAwards(matchId);
	if (derived.error != null) {
		await interaction.deleteReply();
		return await interaction.message.edit({ content: derived.error, embeds: [], components: [] });
	}

	const { season, tier } = derived;
	const groups = [
		{ shorthand: `WIN`, recipients: derived.winRecipients },
		{ shorthand: `WIN_FM`, recipients: derived.fmRecipients },
		{ shorthand: `WIN_SUB`, recipients: derived.subRecipients },
	];

	let createdCount = 0;
	let existingCount = 0;
	for (const group of groups) {
		for (const recipient of group.recipients) {
			const { created } = await awardAccoladeIfAbsent({ userID: recipient.userID, season: season, tier: tier, shorthand: group.shorthand });
			if (created) createdCount++;
			else existingCount++;
		}
	}

	const summary = new EmbedBuilder(embed);
	summary.setDescription(`Awarded **${createdCount}** new accolade(s); **${existingCount}** already present.`);
	summary.setFields([]);
	await interaction.message.edit({ embeds: [summary], components: [] });
	return await interaction.deleteReply();
}

module.exports = {
	requestAwardFinal: requestAwardFinal,
	confirmAwardFinal: confirmAwardFinal,
};
