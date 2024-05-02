const { Team, Franchise, ControlPanel } = require(`../../../prisma`);
const { EmbedBuilder, ChatInputCommandInteraction } = require("discord.js");

const { LeagueStatus, ContractStatus } = require("@prisma/client");

const imagesURL = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos`;
const sum = (array) => array.reduce((s, v) => s += v == null ? 0 : v, 0);

module.exports = {

   name: `roster`,

   async execute(/** @type ChatInputCommandInteraction */ interaction) {
      await interaction.deferReply();

      const showMMR = await ControlPanel.getMMRDisplayState();


      const { _hoistedOptions } = interaction.options;

      // get data from DB
      const teamName = _hoistedOptions[0].value;
      const team = await Team.getBy({ name: teamName });
      const teamRoster = await Team.getRosterBy({ name: teamName });
      const franchise = await Franchise.getBy({ teamName: teamName });
      const gmIDs = [
         franchise.GM?.Accounts.find(a => a.provider == `discord`).providerAccountId,
         franchise.AGM1?.Accounts.find(a => a.provider == `discord`).providerAccountId,
         franchise.AGM2?.Accounts.find(a => a.provider == `discord`).providerAccountId
      ].filter(v => v !== undefined)

      const teamMMRCap = (await ControlPanel.getMMRCaps("TEAM"))[team.tier];

      // process db data and organize for display
      const refinedRoster = await refinedRosterData(interaction, teamRoster);

      // filter by rostered/IR & suvs and format with Riot ID, Tracker link & add emotes
      const rosteredPlayers = refinedRoster
         .filter(player => (player.leagueStatus === LeagueStatus.SIGNED || player.leagueStatus === LeagueStatus.GENERAL_MANAGER) && player.contractStatus !== ContractStatus.INACTIVE_RESERVE)
         .map((player) => `${player.captain ? `🪖` : `👤`} ${showMMR ? `| \` ${String(player.mmr).padStart(3)} \`` : ``} | [${player.riotIDPlain}](${player.trackerURL})`).join(`\n`);
      const inactiveReserve = refinedRoster
         .filter(player => (player.leagueStatus === LeagueStatus.SIGNED || player.leagueStatus === LeagueStatus.GENERAL_MANAGER) && player.contractStatus === ContractStatus.INACTIVE_RESERVE)
         .map((player) => `🛡️ ${showMMR ? `| \` ${String(player.mmr).padStart(3)} \`` : ``} | [${player.riotIDPlain}](${player.trackerURL})`).join(`\n`);
      const activeSub = refinedRoster
         .filter(player => (player.leagueStatus === LeagueStatus.FREE_AGENT || player.leagueStatus === LeagueStatus.RESTRICTED_FREE_AGENT) && player.contractStatus === ContractStatus.ACTIVE_SUB)
         .map((player) => `📝 ${showMMR ? `| \` ${String(player.mmr).padStart(3)} \`` : ``} | [${player.riotIDPlain}](${player.trackerURL})`).join(`\n`);
      const expiringContract = refinedRoster
         .filter(player => (player.leagueStatus === LeagueStatus.SIGNED || player.leagueStatus === LeagueStatus.GENERAL_MANAGER) && player.contractStatus === ContractStatus.SIGNED && player.contractRemaining === 0)
         .map((player) => `📤  ${showMMR ? `| \` ${String(player.mmr).padStart(3)} \`` : ``} | [${player.riotIDPlain}](${player.trackerURL})`).join(`\n`);

      // add if the type of sub ONLY IF it has players in it
      const description = [];
      if (rosteredPlayers.length > 0) description.push([`__Rostered Players__`, rosteredPlayers].join(`\n`));
      if (inactiveReserve.length > 0) description.push([`__Inactive Reserve__`, inactiveReserve].join(`\n`));
      if (activeSub.length > 0) description.push([`__Active Substitute(s)__`, activeSub].join(`\n`));
      if (expiringContract.length > 0) description.push([`__Expiring Contract(s)__`, expiringContract].join(`\n`));

      // filter mmr to only include signed players who are not on IR (this ignores FA & RFA)
      const teamMMRArr = refinedRoster
         .filter(player => player.leagueStatus === LeagueStatus.SIGNED && player.contractStatus !== ContractStatus.INACTIVE_RESERVE)
         .map((player) => player.mmr);
      const teamMMR = sum(teamMMRArr);

      // build and then send the embed confirmation
      const embed = new EmbedBuilder({
         author: { name: `${franchise.name} - ${teamName}`, icon_url: `${imagesURL}/${franchise.Brand.logo}` },
         description: `\`   Managers \` : ${gmIDs.map(gm => `<@${gm}>`)}\n\`       Tier \` : ${team.tier}${showMMR ? `\n\`   Team MMR \` : ${teamMMR} / ${teamMMRCap}` : ``}`,
         color: 0xE92929,
         fields: [
            {
               name: `\u200B`,
               value: `${description.join(`\n\n`)}`,
               inline: false
            }
         ],
         footer: { text: `Valorant Draft Circuit — ${franchise.name}` }
      });

      // send the embed
      return await interaction.editReply({ embeds: [embed] });
   }
};


async function refinedRosterData(/** @type ChatInputCommandInteraction */ interaction, teamData) {
   const players = [];

   await teamData.roster.forEach(async (player) => {
      players.push({
         id: player.id,
         riotIDPlain: player.PrimaryRiotAccount.riotIGN.split(`#`)[0],
         riotID: player.PrimaryRiotAccount.riotIGN,
         trackerURL: `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(player.PrimaryRiotAccount.riotIGN)}`,
         captain: player.Captain != null,
         mmr: Math.round(player.PrimaryRiotAccount.MMR.mmrEffective),
         leagueStatus: player.Status.leagueStatus,
         contractStatus: player.Status.contractStatus,
         contractRemaining: player.Status.contractRemaining,
      });
   });

   return players;
}
