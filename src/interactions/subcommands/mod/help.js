const { ChatInputCommandInteraction, EmbedBuilder } = require(`discord.js`);

const MOD_COLOR = 0xe92929;

const COMMAND_GUIDE = [
  {
    name: `/mod note`,
    value: [
      `Attach a staff-internal note to a player.\nLogged to the dashboard only.\nThe player is NOT notified.`,
      `> \`/mod note user:@yuls reason:Rule 4: Spoke with player about spamming, no action taken\``,
    ].join(`\n`),
  },
  {
    name: `/mod warn`,
    value: [
      `Warn a player. \`formal:\` picks formal vs informal (formal warnings are appealable, informal ones are not).\nThe player is DM'ed the warning.`,
      `> \`/mod warn user:@yuls formal:True rules:Rule 36: Unsportsmanlike conduct reason:Flaming teammates in comms\``,
    ].join(`\n`),
  },
  {
    name: `/mod mute`,
    value: [
      `Strips ALL of the player's roles and applies the Muted role.\nRoles are restored automatically on unmute/expiry.\nThe player is DM'ed.`,
      `> \`/mod mute user:@yuls duration:12h rules:Rule 8: Toxicity reason:Continued after a formal warning\``,
    ].join(`\n`),
  },
  {
    name: `/mod ban`,
    value: [
      `Bans the player from the server (works even if they already left).\nThe DM is sent before the ban lands.`,
      `> \`/mod ban user:@yuls duration:2seasons rules:Rule 1: Cheating reason:Smurfing on an alt appealable:False\``,
    ].join(`\n`),
  },
  {
    name: `/mod mapban`,
    value: [
      `Bans the player from playing their next N maps.\nA regular-season match day counts as 2 maps; the ban pauses while the player is on IR, retired, or otherwise not an active player, and unserved maps carry into the next season.\nThe player is DM'ed with the match day they become eligible again.`,
      `> \`/mod mapban user:@yuls maps:3 rules:Rule 12: No-show reason:Missed match without notice\``,
    ].join(`\n`),
  },
  {
    name: `/mod unmute + /mod unban`,
    value: [
      `Lift a sanction early (e.g. a successful appeal).\nThe record stays on the dashboard with an appeal note.`,
      `> \`/mod unmute user:@yuls reason:Appeal accepted\``,
    ].join(`\n`),
  },
  {
    name: `/mod log`,
    value: [
      `Look up one action by the \`#id\` shown in /mod history.\nIncludes full message, moderator, dates, expiry.`,
      `> \`/mod log id:590\``,
    ].join(`\n`),
  },
  {
    name: `/mod history`,
    value: [
      `Show a player's moderation timeline (5 per page with Back/Next buttons, active punishments marked).`,
      `> \`/mod history user:@yuls\``,
    ].join(`\n`),
  },
  {
    name: `Options`,
    value: [
      `- \`duration:\` any number + unit (s/m/h/d/w)\n  - e.g. \`45s\`, \`30m\`, \`12h\`, \`32d\`, \`2w\`, or \`perm\`.\n  - Bans also accept \`season\` or \`Nseasons\` where N = number of seasons (67seasons).\n  - Timed punishments lift automatically.`,
      `- \`rules:\` the rules broken.\n  - e.g. \`Rule 36: Unsportsmanlike conduct, Rule 8: ...\``,
      `- \`reason:\` your explanation; shown to the player and on the dashboard.`,
      `- \`appealable:\` OPTIONAL. for Formal Warnings/Mutes/Bans only, defaults to yes when omitted.\n  - When no, the player's DM says the punishment cannot be appealed.`,
    ].join(`\n`),
  },
  {
    name: `Good to knows`,
    value: [
      `- Every action shows a Confirm/Cancel gate before anything happens.`,
      `- All actions are recorded to ModLogs and appear on the moderator dashboard (https://vdc.gg/staff/moderation).`,
      `- You need a linked VDC account to act.`,
      `- Muted players who leave and rejoin are re-muted automatically.`,
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
