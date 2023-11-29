const { Team, Franchise } = require(`../../prisma`);
const { EmbedBuilder, ApplicationCommand, DiscordAPIError } = require("discord.js");

const { ROLES } = require("../../utils/enums");

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

   /** Execution script for CommandInteraction 
    * @param {ApplicationCommand} interaction 
    */
   async execute(interaction) {
      await interaction.deferReply();
      const { _hoistedOptions } = interaction.options;

      // get data from DB
      const teamName = _hoistedOptions[0].value;
      const team = await Team.getBy({name:teamName });
      const teamRoster = await Team.getRosterBy({ name: teamName });
      const franchise = await Franchise.getBy({ teamName: teamName });

      // process db data and organize for display
      const refinedRoster = await refinedRosterData(interaction, teamRoster);

      // build and then send the embed confirmation
      const embed = new EmbedBuilder({
         author: { name: `${franchise.name} - ${teamName}`, icon_url: `${imagesURL}/${franchise.logoFileName}` },
         description: `\`     Tier \` : ${team.tier}\n\` Team MMR \` : ${sum(refinedRoster.map((player) => player.mmr))} / ${teamMMRAllowance[team.tier.toLowerCase()]}`,
         color: 0xE92929,
         fields: [
            {
               name: `\u200B`,
               value: `${refinedRoster.map((player) => `${player.captain ? `🪖` : `👤`} | [${player.riotIDPlain}](${player.trackerURL})`).join(`\n`)}`,
               inline: false
            },
         ],
         footer: { text: `Valorant Draft Circuit — ${franchise.name}` }
      });

      // send the embed
      return await interaction.editReply({ embeds: [embed] });
   }
};

/**
 * 
 * @param {ApplicationCommand} interaction command interaction
 * @param {[Object]} teamRoster 
 */
async function refinedRosterData(interaction, teamRoster) {
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
         guildMember: guildMember,
      });
   });

   return players;
}
