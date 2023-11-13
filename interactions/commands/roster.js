const { Team, Franchise } = require(`../../prisma`);
const { EmbedBuilder, ApplicationCommand, DiscordAPIError } = require("discord.js");

const { ROLES } = require("../../utils/enums");

const imagesURL = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos`;
const trackerURL = `https://tracker.gg/valorant/profile/riot`;

const sum = (array) => array.reduce((s, v) => s += v == null ? 0 : v, 0);

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
      const roster = await Team.getRosterBy({ name: teamName });
      const franchise = await Franchise.getBy({ teamName: teamName });

      // process db data and organize for display
      const player = await refinedRosterData(interaction, roster);

      // build and then send the embed confirmation
      const embed = new EmbedBuilder({
         author: { name: `${franchise.name} - ${teamName}`, icon_url: `${imagesURL}/${franchise.logoFileName}` },
         description: `\`     Tier \` : ${teamName}\n\` Team MMR \` : ${sum(player.map((p) => p.mmr))}`,
         color: 0xE92929,
         fields: [
            {
               name: `\u200B`,
               value: `${player.map(g => g.captain ? `🪖` : `👤`).join(`\n`)}`,
               inline: true
            },
            {
               name: `\u200B`,
               value: player.map((p) => `[${p.riotIDPlain}](${trackerURL}\\${sanatizeURL(p.riotID)})`.padEnd(20, ` `)).join(`\n`),
               inline: true
            },
            {
               name: `\u200B`,
               value: `\u200B`,
               inline: true
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
 * @param {[Object]} roster 
 */
async function refinedRosterData(interaction, roster) {
   const players = [];

   await roster.forEach(async (p) => {
      const guildMember = await interaction.guild.members.fetch(p.id).catch(e => e);
      players.push({
         id: p.id,
         mmr: p.mmr,
         riotIDPlain: p.Account.riotID.split(`#`)[0],
         riotID: p.Account.riotID,
         captain: !(guildMember instanceof DiscordAPIError) ? guildMember._roles.includes(ROLES.LEAGUE.CAPTAIN) : undefined,
         guildMember: guildMember,
      });
   });

   return players;
}

function sanatizeURL(string) {
   const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìıİłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
   const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
   const p = new RegExp(a.split('').join('|'), 'g')
 
   return string.toString().toLowerCase()
     .replace(/\s+/g, '-') // Replace spaces with -
     .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
     .replace(/&/g, '-and-') // Replace & with 'and'
     .replace(/[^\w\-]+/g, '') // Remove all non-word characters
     .replace(/\-\-+/g, '-') // Replace multiple - with single -
     .replace(/^-+/, '') // Trim - from start of text
     .replace(/-+$/, '') // Trim - from end of text
 }