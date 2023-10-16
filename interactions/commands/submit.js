const { Games } = require(`../../prisma`);
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder } = require("discord.js");

const validMatchRegex = /^https:\/\/tracker.gg\/valorant\/match\/([a-z0-9]{8})-([a-z0-9]{4}-){3}([a-z0-9]{12})$/;

module.exports = {

   name: `submit`,

   async execute(interaction) {
      const { _hoistedOptions } = interaction.options;

      const tier = _hoistedOptions[0].value;
      const type = _hoistedOptions[1].value;
      const url = _hoistedOptions[2].value;

      // check URL integrity - if it doesn't look like a valid URL, send an error message
      if (!validMatchRegex.test(url)) return interaction.reply({ content: `That doesn't look like a valid match URL! Please try again or reach out to Travestey!`, ephemeral: true });

      // check to see if the match was already submitted. if it was, send an error message
      const matchID = url.replace(`https://tracker.gg/valorant/match/`, ``);
      const exists = await Games.exists({ id: matchID });
      if (exists) return interaction.reply({ content: `Looks like this match was already submitted!`, ephemeral: true });

      // save the match to the database
      const matchType = type == `Combine` ? `${type} - ${tier}` : tier;
      await Games.saveMatch({ id: matchID, type: matchType });

      // build and then send the embed confirmation
      const embed = new EmbedBuilder({
         author: { name: `VDC Match Submission` },
         description: `Your match was successfully submitted!`,
         thumbnail: { url: `https://cdn.discordapp.com/banners/963274331251671071/57044c6a68be1065a21963ee7e697f80.webp?size=480` },
         color: 0xE92929,
         fields: [
            {
               name: `\u200B`,
               value: `Tier:\nType:\nMatch ID:`,
               inline: true
            },
            {
               name: `\u200B`,
               value: `${tier}\n${type}\n[${matchID}](${url})`,
               inline: true
            }
         ]
      });

      return interaction.reply({ embeds: [embed] });
   }
};