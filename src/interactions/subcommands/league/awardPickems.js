const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } = require(`discord.js`);
const { Tier } = require(`@prisma/client`);
const { Player } = require(`../../../../prisma`);
const { LeagueNavigationOptions } = require(`../../../../utils/enums`);
const { getPickemAwards } = require(`../../../../utils/web/vdcWeb`);
const { decodeAccoladeData, awardAccoladeIfAbsent } = require(`../../../helpers/league/accolades`);

const OVERALL_SHORTHANDS = [`PICKEM_1ST`, `PICKEM_2ND`, `PICKEM_3RD`];

function discordIdFromAccounts(accounts) {
	return accounts?.find((account) => account.provider === `discord`)?.providerAccountId ?? null;
}

function formatRecipients(recipients) {
	if (recipients.length === 0) return `*none*`;
	return recipients.map((r) => (r.discordID ? `<@${r.discordID}>` : `\`${r.userID}\``)).join(`, `);
}

/** Fetch the season's pickem winners from the website and flatten them into
 * accolade entries. Overall and top-group accolades are league-wide so they use
 * the MIXED tier sentinel; tier winners use their real tier. Returns { error }
 * for any refusal, and is deterministic so the confirm handler can re-run it. */
async function derivePickemAwards(season) {
	const awards = await getPickemAwards(season);
	if (awards == null) return { error: `Could not fetch pickem awards for season \`${season}\` from the website.` };

	const entries = [];
	(awards.overall ?? []).forEach((userID, index) => {
		if (userID != null && OVERALL_SHORTHANDS[index]) entries.push({ userID: userID, shorthand: OVERALL_SHORTHANDS[index], tier: Tier.MIXED });
	});
	for (const [tier, userID] of Object.entries(awards.perTier ?? {})) {
		if (userID != null) entries.push({ userID: userID, shorthand: `PICKEM_TIER_WINNER`, tier: tier });
	}
	for (const userID of awards.topGroup?.memberUserIds ?? []) {
		entries.push({ userID: userID, shorthand: `PICKEM_TOP_GROUP`, tier: Tier.MIXED });
	}

	if (entries.length === 0) return { error: `No pickem winners were found for season \`${season}\` (is it resolved yet?).` };

	const withDiscord = await Promise.all(entries.map(async (entry) => {
		const player = await Player.getBy({ userID: entry.userID });
		return { ...entry, discordID: discordIdFromAccounts(player?.Accounts) };
	}));

	return { season: season, entries: withDiscord };
}

/** Preview the derived pickem awards behind a confirmation button.
 * @param {ChatInputCommandInteraction} interaction
 */
async function requestAwardPickems(interaction) {
	const season = interaction.options._hoistedOptions.find((option) => option.name === `season`).value;

	const derived = await derivePickemAwards(season);
	if (derived.error != null) return await interaction.editReply(derived.error);

	const recipientsByShorthand = new Map();
	for (const entry of derived.entries) {
		if (!recipientsByShorthand.has(entry.shorthand)) recipientsByShorthand.set(entry.shorthand, []);
		recipientsByShorthand.get(entry.shorthand).push(entry);
	}

	const fields = [];
	for (const [shorthand, recipients] of recipientsByShorthand) {
		const data = decodeAccoladeData(shorthand);
		fields.push({ name: `${data.title} (${recipients.length})`, value: formatRecipients(recipients) });
	}
	fields.push({ name: `Season`, value: `${season}` });

	const embed = new EmbedBuilder({
		author: { name: `VDC League Manager` },
		description: `Award **Season ${season}** pickem accolades to the following?`,
		color: 0xe92929,
		fields: fields,
		footer: { text: `League — Award Pickems` },
	});

	const cancel = new ButtonBuilder({ customId: `league_${LeagueNavigationOptions.CANCEL}`, label: `Cancel`, style: ButtonStyle.Danger });
	const confirm = new ButtonBuilder({ customId: `league_${LeagueNavigationOptions.PICKEM_CONFIRM}`, label: `Confirm`, style: ButtonStyle.Success });
	const row = new ActionRowBuilder({ components: [cancel, confirm] });

	return await interaction.editReply({ embeds: [embed], components: [row] });
}

/** Award the accolades on confirm, re-deriving from the stashed season so the
 * write reflects current standings, then report created vs already-present.
 * @param {ChatInputCommandInteraction} interaction
 */
async function confirmAwardPickems(interaction) {
	const embed = interaction.message.embeds[0];
	const seasonField = embed.fields.find((field) => field.name === `Season`);
	const season = Number(seasonField.value);

	const derived = await derivePickemAwards(season);
	if (derived.error != null) {
		await interaction.deleteReply();
		return await interaction.message.edit({ content: derived.error, embeds: [], components: [] });
	}

	let createdCount = 0;
	let existingCount = 0;
	for (const entry of derived.entries) {
		const { created } = await awardAccoladeIfAbsent({ userID: entry.userID, season: season, tier: entry.tier, shorthand: entry.shorthand });
		if (created) createdCount++;
		else existingCount++;
	}

	const summary = new EmbedBuilder(embed);
	summary.setDescription(`Awarded **${createdCount}** new accolade(s); **${existingCount}** already present.`);
	summary.setFields([]);
	await interaction.message.edit({ embeds: [summary], components: [] });
	return await interaction.deleteReply();
}

module.exports = {
	requestAwardPickems: requestAwardPickems,
	confirmAwardPickems: confirmAwardPickems,
};
