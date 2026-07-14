const { EmbedBuilder } = require(`discord.js`);
const { GUILD, CHANNELS } = require(`../../../utils/enums`);

const MOD_COLOR = 0xe92929;

const APPEAL_TICKETS_URL = `https://discord.com/channels/${GUILD}/${CHANNELS.TICKETS}`;
const BAN_APPEAL_URL = `https://go.vdc.gg/banappeal`;
const RULEBOOK_URL = `https://go.vdc.gg/rulebook`;
const GUIDELINES_URL = `https://go.vdc.gg/guidelines`;

/** Read a named field's value from the confirmation embed
 * @param {import('discord.js').Embed} embed
 * @param {string} name
 */
function getEmbedField(embed, name) {
	const field = embed.fields.find((f) => f.name === name);
	return field ? field.value : null;
}

/** Confirmation embed shown before any mutating action executes.
 * `appealable` is only meaningful for mute/ban; other actions omit it. */
function buildConfirmationEmbed({ action, targetUser, durationLabel, rules, reason, appealable }) {
	const fields = [
		{ name: `Action`, value: action, inline: true },
		{ name: `Target`, value: `${targetUser}`, inline: true },
		{ name: `Target ID`, value: `\`${targetUser.id}\``, inline: true },
		{ name: `Duration`, value: durationLabel ?? `-`, inline: true },
	];
	if (appealable !== undefined) {
		fields.push({ name: `Appealable`, value: appealable ? `Yes` : `No`, inline: true });
	}
	fields.push({ name: `Rules`, value: rules ?? `-` }, { name: `Reason`, value: reason });

	return new EmbedBuilder({
		author: { name: `VDC Moderation` },
		description: `Are you sure you want to perform the following action?`,
		color: MOD_COLOR,
		fields,
		footer: { text: `Moderation - ${action}` },
	});
}

/** Mod-log channel announcement */
function buildLogEmbed({ action, targetID, targetTag, modTag, durationLabel, rules, reason, appealable, extra }) {
	const lines = [
		`**Target:** <@${targetID}> (\`${targetTag ?? targetID}\`)`,
		`**Moderator:** \`${modTag}\``,
		durationLabel ? `**Duration:** ${durationLabel}` : null,
		appealable !== undefined ? `**Appealable:** ${appealable ? `Yes` : `No`}` : null,
		rules ? `**Rules:** ${rules}` : null,
		`**Reason:** ${reason}`,
		extra ?? null,
	].filter((line) => line !== null);

	return new EmbedBuilder({
		author: { name: `VDC Moderation` },
		title: action,
		description: lines.join(`\n`),
		color: MOD_COLOR,
		footer: { text: `Moderation - ${action}` },
		timestamp: Date.now(),
	});
}

/** DM sent to the sanctioned player - follows the standard punishment template.
 * `appealable: false` (mute/ban/mapban only) replaces the appeal path with an
 * explicit statement; omitted/true keeps the standard appeal line. */
function buildDmEmbed({ action, guildName, durationLabel, rules, reason, expires, appealable, mapCount, eligibilityLine }) {
	const seasonCount = durationLabel?.match(/^(\d+)?seasons?$/)?.[1];
	const expiryLine = expires
		? `This expires <t:${Math.round(expires.getTime() / 1000)}:R>.`
		: durationLabel === `permanent` ? `This is permanent.`
		: durationLabel === `season` ? `This ban lasts through the current season.`
		: seasonCount ? `This ban lasts for ${seasonCount} seasons, including the current one.` : null;

	const mapCountLine = mapCount !== undefined
		? `**Number of Maps Banned:** ${mapCount}`
		: null;

	const appealableLine = appealable !== undefined
		? `**Appealable:** ${appealable ? `Yes` : `No`}`
		: null;

	const appealLine = appealable === false
		? `This punishment is not appealable.`
		: action === `BAN`
			? `If you'd like to appeal this punishment, use the ban appeal form: ${BAN_APPEAL_URL}`
			: `If you'd like to appeal this punishment, you may do so via ${APPEAL_TICKETS_URL}`;

	const lines = [
		`You have received a **${action.replaceAll(`_`, ` `)}** in **${guildName}**.`,
		rules ? `**Rules broken:** ${rules}` : null,
		mapCountLine,
		`**Reason:** ${reason}`,
		expiryLine,
		appealableLine,
		eligibilityLine ?? null,
		``,
		appealLine,
		`If you have any questions about the expectations of the league or the rules, please refer to the rulebook: ${RULEBOOK_URL}. For more information on the VDC Behavioral Guidelines, see: ${GUIDELINES_URL}`,
	].filter((line) => line !== null);

	return new EmbedBuilder({
		description: lines.join(`\n`),
		color: MOD_COLOR,
		footer: { text: `VDC Moderation` },
		timestamp: Date.now(),
	});
}

function buildMapBanLiftedEmbed({ discordID, liftedMaps }) {
	return new EmbedBuilder({
		author: { name: `VDC Moderation` },
		description: `<@${discordID}>'s map ban has been lifted (\`${liftedMaps}\` remaining map${liftedMaps === 1 ? `` : `s`} appealed/removed) and they are eligible to play again.`,
		color: MOD_COLOR,
		footer: { text: `Moderation - Map Ban Lifted` },
		timestamp: Date.now(),
	});
}

function buildMapBanServedEmbed({ discordID, mapsServed }) {
	return new EmbedBuilder({
		author: { name: `VDC Moderation` },
		description: `<@${discordID}> has fully served their map ban (\`${mapsServed}\` map${mapsServed === 1 ? `` : `s`}) and is eligible to play again.`,
		color: MOD_COLOR,
		footer: { text: `Moderation - Map Ban Served` },
		timestamp: Date.now(),
	});
}

const HISTORY_PAGE_SIZE = 5;

/** Player history timeline embed, paginated. The player mention in the
 * description and the page counter in the footer carry the state the
 * pagination buttons recover (same recover-from-message idiom as the
 * confirmation embeds). */
function buildHistoryEmbed({ targetUser, rows, page = 0 }) {
	const now = Date.now();
	const totalPages = Math.max(1, Math.ceil(rows.length / HISTORY_PAGE_SIZE));
	const clampedPage = Math.min(Math.max(page, 0), totalPages - 1);
	const pageRows = rows.slice(clampedPage * HISTORY_PAGE_SIZE, (clampedPage + 1) * HISTORY_PAGE_SIZE);

	const lines = pageRows.map((row) => {
		const timestamp = `<t:${Math.round(row.date.getTime() / 1000)}:d>`;
		const isActive = (row.type === `MUTE` || row.type === `BAN`)
			&& (row.expires === null || row.expires.getTime() > now);
		const status = isActive ? ` **[ACTIVE]**` : ``;
		const firstLine = row.message.split(`\n`)[0];
		return `\`#${row.id}\` ${timestamp} \`${row.type}\`${status} - ${firstLine}`;
	});

	return new EmbedBuilder({
		author: { name: `VDC Moderation` },
		title: `Moderation history`,
		description: [
			`**Player:** ${targetUser} (\`${targetUser.id}\`)`,
			`**Total entries:** ${rows.length}`,
			``,
			lines.length > 0 ? lines.join(`\n`) : `No moderation history.`,
		].join(`\n`),
		color: MOD_COLOR,
		footer: { text: `Moderation - History | Page ${clampedPage + 1}/${totalPages}` },
		timestamp: Date.now(),
	});
}

/** Full detail of one ModLogs row (for /mod action <id>) */
function buildActionDetailEmbed(row) {
	const now = Date.now();
	const isActive = (row.type === `MUTE` || row.type === `BAN`)
		&& (row.expires === null || row.expires.getTime() > now);

	const expiryValue = row.expires === null
		? (isActive ? `never (permanent or season-scoped)` : `-`)
		: `<t:${Math.round(row.expires.getTime() / 1000)}:f>`;

	return new EmbedBuilder({
		author: { name: `VDC Moderation` },
		title: `Action #${row.id} - ${row.type}${isActive ? ` [ACTIVE]` : ``}`,
		color: MOD_COLOR,
		fields: [
			{ name: `Target`, value: `<@${row.discordID}> (\`${row.discordID}\`)`, inline: true },
			{ name: `Moderator`, value: `\`${row.Moderator?.name ?? row.modID}\``, inline: true },
			{ name: `Date`, value: `<t:${Math.round(row.date.getTime() / 1000)}:f>`, inline: true },
			{ name: `Expires`, value: expiryValue, inline: true },
			{ name: `Message`, value: row.message.slice(0, 1024) },
		],
		footer: { text: `Moderation - Action #${row.id}` },
		timestamp: Date.now(),
	});
}

/** Recover the pagination state buildHistoryEmbed wrote onto the message. */
function parseHistoryEmbedState(embed) {
	const targetID = embed.description?.match(/\*\*Player:\*\* <@(\d+)>/)?.[1] ?? null;
	const pageMatch = embed.footer?.text?.match(/Page (\d+)\/(\d+)/);
	const page = pageMatch ? Number(pageMatch[1]) - 1 : 0;
	return { targetID, page };
}

module.exports = { getEmbedField, buildConfirmationEmbed, buildLogEmbed, buildDmEmbed, buildMapBanServedEmbed, buildMapBanLiftedEmbed, buildHistoryEmbed, buildActionDetailEmbed, parseHistoryEmbedState, HISTORY_PAGE_SIZE };
