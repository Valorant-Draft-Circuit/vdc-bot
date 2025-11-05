const { Team, Franchise, ControlPanel, Games } = require(`../../../prisma`);
const { EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

const { LeagueStatus, ContractStatus, MatchType } = require("@prisma/client");
const { prisma } = require("../../../prisma/prismadb");

const { COLORS } = require("../../../utils/enums/colors");

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

      const [team, teamRoster, franchise, season] = await Promise.all([
         Team.getBy({ name: teamName }),
         Team.getRosterBy({ name: teamName }),
         Franchise.getBy({ teamName: teamName }),
         ControlPanel.getSeason()
      ]);
      const gmIDs = [
         franchise.GM?.Accounts.find(a => a.provider == `discord`).providerAccountId,
      ].filter(v => v !== undefined);
      const agmIDs = [
         franchise.AGM1?.Accounts.find(a => a.provider == `discord`).providerAccountId,
         franchise.AGM2?.Accounts.find(a => a.provider == `discord`).providerAccountId,
         franchise.AGM3?.Accounts.find(a => a.provider == `discord`).providerAccountId,
         franchise.AGM4?.Accounts.find(a => a.provider == `discord`).providerAccountId,
      ].filter(v => v !== undefined);

      const teamMMRCap = (await ControlPanel.getMMRCaps("TEAM"))[team.tier];

      // process db data and organize for display
      const refinedRoster = await refinedRosterData(interaction, teamRoster);
      refinedRoster.sort((a, b) => {
         if (showMMR) {
            return a.mmr - b.mmr;
         } else {
            return a.riotIDPlain.localeCompare(b.riotIDPlain);
         }
      });
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
         .filter(player => player.contractStatus !== ContractStatus.INACTIVE_RESERVE)
         .map((player) => player.mmr);
      const teamMMR = sum(teamMMRArr);

      // build and then send the embed confirmation
      const embed = new EmbedBuilder({
         author: { name: `${franchise.name} - ${teamName}`, icon_url: `${imagesURL}/${franchise.Brand.logo}` },
         description: [
            `\`         GM \` : ${gmIDs.map(gm => `<@${gm}>`)}`,
            `\`       AGMs \` : ${agmIDs.map(agm => `<@${agm}>`)}`,
            `\`       Tier \` : ${team.tier[0].toUpperCase() + team.tier.substring(1).toLowerCase()}`,
            `\`       Data \` : T \` ${team.id} \` | F \` ${franchise.id} \``,
            `${showMMR ? `\`   Team MMR \` : ${teamMMR} / ${teamMMRCap} (Δ${teamMMRCap - teamMMR})` : ``}`,
            team.captain ? await createFranchiseStatsModule(team, team.Captain, season) : ``
         ].join(`\n`),
         color: COLORS[team.tier],
         fields: [
            {
               name: `\u200B`,
               value: `${description.join(`\n\n`)}`,
               inline: false
            }
         ],
         footer: { text: `Valorant Draft Circuit — ${franchise.name}` }
      });

      const matchesPlayed = (await prisma.matches.findMany({
         where: {
            OR: [
               { home: team.id },
               { away: team.id },
            ],
            season: season,
            matchType: MatchType.BO2,
         },
         include: {
            Games: true,
            Home: { include: { Franchise: { include: { Brand: true } } } },
            Away: { include: { Franchise: { include: { Brand: true } } } },
         },
      })).filter(g => g.Games.length !== 0);

      let md = 1;
      const matchesPlayedOptions = matchesPlayed.map((m) => {
         const map1 = m.Games[0];
         const map2 = m.Games[1];

         if (map1 == null || map2 == null) return;

         const label = [
            `Match Day ${md}`,
            `${m.Home.Franchise.slug} v. ${m.Away.Franchise.slug}`,
            `${map1.map} : ${map1.roundsWonHome}-${map1.roundsWonAway}, ${map2.map} : ${map2.roundsWonHome}-${map2.roundsWonAway}`
         ].filter(v => v != null).join(` | `);
         md++;
         return { label: label, value: String(map1.matchID), emoji: team.Franchise.Brand.discordEmote };
      }).filter(v => v != null);

      // create the action row, add the component to it & then reply with all the data
      const homeRow = new ActionRowBuilder({
         components: [new StringSelectMenuBuilder({
            customId: `maphistory_roster`,
            placeholder: `${team.Franchise.slug} ${team.name} Match History`,
            options: matchesPlayedOptions,
         })]
      });

      // safely add the components to the reply object if there are any matches played
      const replyObject = { embeds: [embed] };
      if (matchesPlayedOptions.length > 0) replyObject.components = [homeRow];

      // send the embed
      return await interaction.editReply(replyObject);
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

/** Create the standings "module" for a franchise if the player is signed to one */
async function createFranchiseStatsModule(team, player, season) {
   // const team = player.Team;
   const franchise = team.Franchise;

   const emote = `<${franchise.Brand.discordEmote}>`;
   const slug = franchise.slug;
   const franchiseName = franchise.name;
   const teamName = team.name;

   const allTeamGames = await Games.getAllBy({ team: team.id, season: season });
   const teamStats = {
      wins: allTeamGames.filter(g => g.winner == team.id).length,
      loss: allTeamGames.filter(g => g.winner !== team.id).length,
      roundsWon: sum(allTeamGames.map(g => g.Match.home === team.id ? g.roundsWonHome : g.roundsWonAway)),
      totalRounds: sum(allTeamGames.map(g => g.rounds))
   }

   // text coloring
   const color = `\u001b[0;30m`;
   const GREEN = `\u001b[0;32m`;
   const RED = `\u001b[0;31m`;

   // centering for team names
   const teamMaxWidth = 20;
   const teamNameLength = teamName.length;
   const startSpaces = Math.ceil((teamMaxWidth - teamNameLength) / 2);

   // create the data array
   const data = [
      // ` # ${teamGameData.rank}`.padEnd(5, ` `),
      (slug.length < 3 ? `${slug} ` : slug).padStart(4, ` `),
      teamName.padStart(teamNameLength + startSpaces, ` `).padEnd(teamMaxWidth, ` `),
      GREEN + String(teamStats.wins).padStart(2, ` `),
      RED + String(teamStats.loss).padStart(2, ` `),
      color + `${((100 * teamStats.roundsWon / teamStats.totalRounds) || 0).toFixed(2)}% `.padStart(6, ` `),
   ];

   // and then format & return the "module"
   return `\n${emote} **${franchiseName}** - ${team.tier[0].toUpperCase() + team.tier.substring(1).toLowerCase()}` + `\n` +
      `\`\`\`ansi\n${color}${data.join(`${color} | `)}\n\`\`\``;
}
