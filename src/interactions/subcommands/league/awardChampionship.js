const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } = require(`discord.js`);
const { Team, Player } = require(`../../../../prisma`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { LeagueNavigationOptions } = require(`../../../../utils/enums`);
const { tierLabel } = require(`../../../helpers/transactions/formatTeam`);
const { decodeAccoladeData, awardAccoladeIfAbsent, appendAccoladeEmoteToNickname, NicknameUpdateOutcome, MAX_DISCORD_NICKNAME_LENGTH } = require(`../../../helpers/league/accolades`);

// game wins needed to clinch a series by match format (grand finals are BO5, or BO3 if downgraded)
const GAMES_TO_CLINCH = { BO2: 2, BO3: 2, BO5: 3 };

// keeps the summary embed's skip list inside Discord's 1024 character field limit
const MAX_NICKNAME_SKIPS_LISTED = 10;

const NICKNAME_SKIP_REASONS = {
	[NicknameUpdateOutcome.NOT_MANAGEABLE]: `my role is below theirs`,
	[NicknameUpdateOutcome.TOO_LONG]: `nickname would exceed ${MAX_DISCORD_NICKNAME_LENGTH} characters`,
	[NicknameUpdateOutcome.FAILED]: `Discord rejected the update`,
};

function discordIdFromAccounts(accounts) {
	return accounts?.find((account) => account.provider === `discord`)?.providerAccountId ?? null;
}

function mentionRecipient(recipient) {
	return recipient.discordID ? `<@${recipient.discordID}>` : `\`${recipient.userID}\``;
}

function formatRecipients(recipients) {
	if (recipients.length === 0) return `*none*`;
	return recipients.map(mentionRecipient).join(`, `);
}

function formatNicknameSkips(skips) {
	const lines = skips.slice(0, MAX_NICKNAME_SKIPS_LISTED).map((skip) => `${mentionRecipient(skip.recipient)}: ${skip.reason}`);

	const unlistedCount = skips.length - lines.length;
	if (unlistedCount > 0) lines.push(`*...and ${unlistedCount} more (see bot alerts)*`);

	return lines.join(`\n`);
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

/** Give every recipient their accolade's emote in the server, so a champion's
 * nickname reads `SLUG | Tag 🏆` the way the transaction commands expect.
 * Runs after the accolade rows are written; the DB is the source of truth, and a
 * member the bot can't rename must never cost anyone their accolade.
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<{ updated: object[], alreadyPresent: object[], skipped: object[] }>}
 */
async function applyChampionshipNicknames(guild, groups) {
	const updated = [];
	const alreadyPresent = [];
	const skipped = [];

	for (const group of groups) {
		const emote = decodeAccoladeData(group.shorthand).emote;

		for (const recipient of group.recipients) {
			if (recipient.discordID == null) {
				skipped.push({ recipient: recipient, reason: `no linked discord account` });
				continue;
			}

			const guildMember = await guild.members.fetch(recipient.discordID).catch(() => null);
			if (guildMember == null) {
				skipped.push({ recipient: recipient, reason: `not in the server` });
				continue;
			}

			const result = await appendAccoladeEmoteToNickname(guildMember, emote);
			if (result.outcome === NicknameUpdateOutcome.UPDATED) {
				updated.push(recipient);
				continue;
			}
			if (result.outcome === NicknameUpdateOutcome.ALREADY_PRESENT) {
				alreadyPresent.push(recipient);
				continue;
			}

			skipped.push({ recipient: recipient, reason: NICKNAME_SKIP_REASONS[result.outcome] });
			logger.log(`ALERT`, `Could not add the ${emote} accolade emote to ${guildMember.user.username}'s nickname (${result.outcome}). Please rename them to \`${result.nickname}\` manually!`);
		}
	}

	return { updated, alreadyPresent, skipped };
}

/** Award the accolades on confirm, re-deriving from the stashed match id so the
 * write reflects current DB state, then hand out the matching nickname emotes and
 * report created vs already-present for both.
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

	const nicknames = await applyChampionshipNicknames(interaction.guild, groups);

	const summaryLines = [
		`Awarded **${createdCount}** new accolade(s); **${existingCount}** already present.`,
		`Renamed **${nicknames.updated.length}** member(s); **${nicknames.alreadyPresent.length}** already had their emote.`,
	];
	const skippedFields = nicknames.skipped.length === 0
		? []
		: [{ name: `Nicknames not updated (${nicknames.skipped.length})`, value: formatNicknameSkips(nicknames.skipped) }];

	const summary = new EmbedBuilder(embed);
	summary.setDescription(summaryLines.join(`\n`));
	summary.setFields(skippedFields);
	await interaction.message.edit({ embeds: [summary], components: [] });
	return await interaction.deleteReply();
}

module.exports = {
	requestAwardFinal: requestAwardFinal,
	confirmAwardFinal: confirmAwardFinal,
};
