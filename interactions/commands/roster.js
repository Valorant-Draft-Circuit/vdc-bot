const { Team, Franchise } = require(`../../prisma`);
const { EmbedBuilder, ApplicationCommand, ChatInputCommandInteraction, DiscordAPIError } = require("discord.js");

const { ROLES, PlayerStatusCode, ContractStatus } = require("../../utils/enums");

const imagesURL = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos`;
const sum = (array) => array.reduce((s, v) => s += v == null ? 0 : v, 0);

const teamMMRAllowance = {
   prospect: 386,
   apprentice: 538,
   expert: 716,
   mythic: 948
}; // max MMR allowance for teams to "spend" on players

module.exports = {

   name: `roster`,

   async execute(/** @type ChatInputCommandInteraction */ interaction) {
      await interaction.deferReply();
      const { _hoistedOptions } = interaction.options;

      // get data from DB
      const teamName = _hoistedOptions[0].value;
      const team = await Team.getBy({ name: teamName });
      const teamRoster = await Team.getRosterBy({ name: teamName });
      const franchise = await Franchise.getBy({ teamName: teamName });

      // process db data and organize for display
      const refinedRoster = await refinedRosterData(interaction, teamRoster);

      // filter by rostered/IR & suvs and format with Riot ID, Tracker link & add emotes
      const rosteredPlayers = refinedRoster
         .filter(player => player.status === PlayerStatusCode.SIGNED && player.contractStatus !== ContractStatus.INACTIVE_RESERVE)
         .map((player) => `${player.captain ? `🪖` : `👤`} | \` ${String(player.mmr).padStart(3)} \` | [${player.riotIDPlain}](${player.trackerURL})`).join(`\n`);
      const inactiveReserve = refinedRoster
         .filter(player => player.status === PlayerStatusCode.SIGNED && player.contractStatus === ContractStatus.INACTIVE_RESERVE)
         .map((player) => `🛡️ | \` ${String(player.mmr).padStart(3)} \` | [${player.riotIDPlain}](${player.trackerURL})`).join(`\n`);
      const activeSub = refinedRoster
         .filter(player => (player.status === PlayerStatusCode.FREE_AGENT || player.status === PlayerStatusCode.RESTRICTED_FREE_AGENT) && player.contractStatus === ContractStatus.ACTIVE_SUB)
         .map((player) => `📝 | \` ${String(player.mmr).padStart(3)} \` | [${player.riotIDPlain}](${player.trackerURL})`).join(`\n`);

      // add if the type of sub ONLY IF it has players in it
      const description = [];
      if (rosteredPlayers.length > 0) description.push([`__Rostered Players__`, rosteredPlayers].join(`\n`));
      if (inactiveReserve.length > 0) description.push([`__Inactive Reserve__`, inactiveReserve].join(`\n`));
      if (activeSub.length > 0) description.push([`__Active Substitute(s)__`, activeSub].join(`\n`));

      // filter mmr to only include signed players who are not on IR (this ignores FA & RFA)
      const teamMMRArr = refinedRoster
         .filter(player => player.status === PlayerStatusCode.SIGNED && player.contractStatus !== ContractStatus.INACTIVE_RESERVE)
         .map((player) => player.mmr);
      const teamMMR = sum(teamMMRArr);

      // build and then send the embed confirmation
      const embed = new EmbedBuilder({
         author: { name: `${franchise.name} - ${teamName}`, icon_url: `${imagesURL}/${franchise.logoFileName}` },
         description: `\`     Tier \` : ${team.tier}\n\` Team MMR \` : ${teamMMR} / ${teamMMRAllowance[team.tier.toLowerCase()]}`,
         color: 0xE92929,
         fields: [
            {
               name: `\u200B`,
               value: `${description.join(`\n\n`)}`,
               inline: false
            },
         ],
         footer: { text: `Valorant Draft Circuit — ${franchise.name}` }
      });

      // send the embed
      return await interaction.editReply({ embeds: [embed] });
   }
};


async function refinedRosterData(/** @type ChatInputCommandInteraction */ interaction, teamRoster) {
   const players = [];

   await teamRoster.forEach(async (player) => {
      const guildMember = await interaction.guild.members.fetch(player.id).catch(err => err);
      players.push({
         id: player.id,
         riotIDPlain: player.Account.riotID.split(`#`)[0],
         riotID: player.Account.riotID,
         trackerURL: `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(player.Account.riotID)}`,
         captain: !(guildMember instanceof DiscordAPIError) ? guildMember._roles.includes(ROLES.LEAGUE.CAPTAIN) : undefined,
         mmr: player.MMR_Player_MMRToMMR.mmr_overall,
         status: player.status,
         contractStatus: player.contractStatus,
         guildMember: guildMember,
      });
   });

   return players;
}
