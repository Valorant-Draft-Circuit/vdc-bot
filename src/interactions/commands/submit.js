const { Games } = require(`../../../prisma`);
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, WebhookClient, Message } = require("discord.js");

const validMatchRegex = /^https:\/\/tracker.gg\/valorant\/match\/([a-z0-9]{8})-([a-z0-9]{4}-){3}([a-z0-9]{12})$/;
const webhookURL = `https://discord.com/api/webhooks/1224147441712889988/mIgidbXQbZP_LarMLrn7oqbYzQvRF9xH_ii3HYogTwAIm5DHyhcbSYUYPvvkqAyZQuDZ`;
const iconURL = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/vdc-logos/champwall.png`;

module.exports = {

   name: `submit`,

   async execute(/** @type ChatInputCommandInteraction */ interaction) {
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
      Games.saveMatch({ id: matchID, tier: tier, type: type });

      // build and then send the embed confirmation
      const embed = new EmbedBuilder({
         author: { name: `VDC Match Submission` },
         // description: `Your match was successfully submitted!`,
         thumbnail: { url: iconURL },
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
         ],
         footer: { text: `Valorant Draft Circuit — Match Result Submissions` }
      });

      // forward the webhook to the thread
      const webhookClient = new WebhookClient({ url: webhookURL });
      await webhookClient.send({
         username: `${type} - ${tier}`,
         avatarURL: iconURL,
         embeds: [embed],
      });
      webhookClient.destroy();

      embed.setDescription(`Your match was successfully submitted!`)
      return interaction.reply({ embeds: [embed] });
   }
};