const { ChatInputCommandInteraction, EmbedBuilder } = require(`discord.js`);

const MOD_COLOR = 0xe92929;

const COMMAND_GUIDE = [
	{
		name: `/mod note`,
		value: `Attach a staff-internal note to a player. Logged to the dashboard only. The player is NOT notified.`,
	},
	{
		name: `/mod warn`,
		value: `Warn a player. \`formal:\` picks formal vs informal. The player is DM'ed the warning.`,
	},
	{
		name: `/mod mute`,
		value: `Strips ALL of the player's roles and applies the Muted role. Roles are restored automatically on unmute/expiry. The player is DM'ed.`,
	},
	{
		name: `/mod ban`,
		value: `Bans the player from the server (works even if they already left). The DM is sent before the ban lands.`,
	},
	{
		name: `/mod unmute + /mod unban`,
		value: `Lift a sanction early (e.g. a successful appeal). The record stays on the dashboard with an appeal note.`,
	},
	{
		name: `/mod history`,
		value: `Show a player's moderation timeline (latest 10 entries, active punishments marked).`,
	},
	{
		name: `Options`,
		value: [
			`\`duration:\` any number + unit (s/m/h/d/w), e.g. \`45s\`, \`30m\`, \`12h\`, \`32d\`, \`2w\` - or \`perm\`. Bans also accept \`season\` or \`4seasons\` (lifts automatically once the last covered season ends). Timed punishments lift automatically.`,
			`\`rules:\` the rules broken, e.g. \`Rule 36: Unsportsmanlike conduct, Rule 8: ...\``,
			`\`reason:\` your explanation; shown to the player and on the dashboard.`,
			`\`appealable:\` OPTIONAL. for Mutes/Bans only, defaults to yes when omitted. When no, the player's DM says the punishment cannot be appealed.`,
		].join(`\n`),
	},
	{
		name: `Good to know`,
		value: [
			`Every action shows a Confirm/Cancel gate before anything happens.`,
			`All actions are recorded to ModLogs and appear on the moderator dashboard (https://vdc.gg/staff/moderator).`,
			`You need a linked VDC account to act.`,
			`Muted players who leave and rejoin are re-muted automatically.`,
		].join(`\n`),
	},
];

async function help(/** @type ChatInputCommandInteraction */ interaction) {
	const embed = new EmbedBuilder({
		author: { name: `VDC Moderation` },
		title: `Moderation commands`,
		color: MOD_COLOR,
		fields: COMMAND_GUIDE,
		footer: { text: `Moderation - Help` },
	});

	return interaction.editReply({ embeds: [embed] });
}

module.exports = { help };
