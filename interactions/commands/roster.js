const { Games, Team, Franchise, Player } = require(`../../prisma`);
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ApplicationCommand } = require("discord.js");

// types
const { CommandInteraction } = require("discord.js");

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
      // interaction.channel.send(`maybe it will be one day`)

      // console.log(await Player.getBy({ign: `Travestey#7227`}))
      // console.log(await Player.getBy({discordID: `382893405178691584`}))
      // Player.getBy();
      // Player.getBy({riotID: `Fx-eQHvJUP-r4DQDIhEqxIu3m40Q-OkjYBkiPqJwIwcynW3vOQv4qLDpvsw-OxDsD1hENoBfxl6Gtg`});

      


      const teamName = _hoistedOptions[0].value;
      const roster = await Team.getRosterBy({ name: teamName });
      const franchise = await Franchise.getBy({ teamName: teamName });

      const a = await refinedRosterData(interaction, roster);

      console.log(a)

      // console.log(sum(a.map(a => a.mmr)))

      // return interaction.reply({ embeds: [embed] });
      // build and then send the embed confirmation
      const embed = new EmbedBuilder({
         author: { name: `${franchise.name} - ${teamName}`, icon_url: `${imagesURL}/${franchise.logoFileName}` },
         description: `\`     Tier \` : ${teamName}\n\` Team MMR \` : ${0}\n　　　　　　　　　　　　　　　　　　　　　`,
         // thumbnail: { url: `${imagesURL}/${franchise.logoFileName}` },
         color: 0xE92929,
         fields: [
            {
               name: `\u200B`,
               value: ``,
               inline: true
            },
            {
               name: `\u200B`,
               value: a.map((g) => `[${g.riotIDPlain}](${trackerURL}\\${g.riotID.replace(`#`, `%23`)})`.padEnd(20, ` `)).join(`\n`),
               inline: true
            },
            // {
            //    name: `\u200B`,
            //    value: a.map(g => g.guildMember).join(`\n`),
            //    inline: true
            // },
         ],
         footer: { text: `Valorant Draft Circuit — ${franchise.name}` }
      });

      return await interaction.editReply({ embeds: [embed] });
      // await interaction.editReply({ content: `ok` , ephemeral: true})
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
         guildMember: guildMember,
      });
   });

   return players;
}