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

/** Confirmation embed shown before any mutating action executes */
function buildConfirmationEmbed({ action, targetUser, durationLabel, rules, reason }) {
	return new EmbedBuilder({
		author: { name: `VDC Moderation` },
		description: `Are you sure you want to perform the following action?`,
		color: MOD_COLOR,
		fields: [
			{ name: `Action`, value: action, inline: true },
			{ name: `Target`, value: `${targetUser}`, inline: true },
			{ name: `Target ID`, value: `\`${targetUser.id}\``, inline: true },
			{ name: `Duration`, value: durationLabel ?? `-`, inline: true },
			{ name: `Rules`, value: rules ?? `-` },
			{ name: `Reason`, value: reason },
		],
		footer: { text: `Moderation - ${action}` },
	});
}

/** Mod-log channel announcement */
function buildLogEmbed({ action, targetID, targetTag, modTag, durationLabel, rules, reason, extra }) {
	const lines = [
		`**Target:** <@${targetID}> (\`${targetTag ?? targetID}\`)`,
		`**Moderator:** \`${modTag}\``,
		durationLabel ? `**Duration:** ${durationLabel}` : null,
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

/** DM sent to the sanctioned player - follows the standard punishment template */
function buildDmEmbed({ action, guildName, durationLabel, rules, reason, expires }) {
	const expiryLine = expires
		? `This expires <t:${Math.round(expires.getTime() / 1000)}:R>.`
		: durationLabel === `permanent` ? `This is permanent.` : null;

	const appealLine = action === `BAN`
		? `If you'd like to appeal this punishment, use the ban appeal form: ${BAN_APPEAL_URL}`
		: `If you'd like to appeal this punishment, you may do so via ${APPEAL_TICKETS_URL}`;

	const lines = [
		`You have received a **${action}** in **${guildName}**.`,
		rules ? `**Rules broken:** ${rules}` : null,
		`**Reason:** ${reason}`,
		expiryLine,
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

/** Player history timeline embed */
function buildHistoryEmbed({ targetUser, rows }) {
	const now = Date.now();
	const lines = rows.slice(0, 10).map((row) => {
		const timestamp = `<t:${Math.round(row.date.getTime() / 1000)}:d>`;
		const isActive = (row.type === `MUTE` || row.type === `BAN`)
			&& (row.expires === null || row.expires.getTime() > now);
		const status = isActive ? ` **[ACTIVE]**` : ``;
		const firstLine = row.message.split(`\n`)[0];
		return `${timestamp} \`${row.type}\`${status} - ${firstLine}`;
	});

	return new EmbedBuilder({
		author: { name: `VDC Moderation` },
		title: `Moderation history`,
		description: [
			`**Player:** ${targetUser} (\`${targetUser.id}\`)`,
			`**Total entries:** ${rows.length}${rows.length > 10 ? ` (showing latest 10)` : ``}`,
			``,
			lines.length > 0 ? lines.join(`\n`) : `No moderation history.`,
		].join(`\n`),
		color: MOD_COLOR,
		footer: { text: `Moderation - History` },
		timestamp: Date.now(),
	});
}

module.exports = { getEmbedField, buildConfirmationEmbed, buildLogEmbed, buildDmEmbed, buildHistoryEmbed };
