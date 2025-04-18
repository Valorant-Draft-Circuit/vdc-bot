const { GameType } = require("@prisma/client");
const { Games, ControlPanel } = require(`../../../prisma`);
const { EmbedBuilder } = require("discord.js");

const validMatchRegex = /^https:\/\/tracker.gg\/valorant\/match\/([a-z0-9]{8})-([a-z0-9]{4}-){3}([a-z0-9]{12})$/;
const iconURL = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/vdc-logos/champwall.png`;
const riotMatchesV1 = `https://na.api.riotgames.com/val/match/v1/matches`;

module.exports = {

   name: `submit`,

   async execute(/** @type ChatInputCommandInteraction */ interaction) {
      interaction.deferReply();
      const { _hoistedOptions } = interaction.options;

      const tier = _hoistedOptions[0].value;
      const url = _hoistedOptions[1].value;

      // check URL integrity - if it doesn't look like a valid URL, send an error message
      if (!validMatchRegex.test(url)) return await interaction.editReply({ content: `That doesn't look like a valid match URL! Please try again or open a tech ticket!` });

      // check to see if the match was already submitted. if it was, send an error message
      const gameID = url.replace(`https://tracker.gg/valorant/match/`, ``);
      const exists = await Games.exists({ id: gameID });
      if (exists) return await interaction.editReply({ content: `Looks like this match was already submitted!` });

      // hit the matches endpoint to check if the match exists using fetch
      const response = await fetch(`${riotMatchesV1}/${gameID}?api_key=${process.env.VDC_API_KEY}`);
      const data = await response.json();
      if (data.matchInfo === undefined) return await interaction.editReply({ content: `There was a problem checking Riot's servers! Please try again or open a tech ticket!` });
      if (data.matchInfo.provisioningFlowId !== `CustomGame`) return await interaction.editReply({ content: `The match you submitted ([\`${gameID}\`](${url})) doesn't look like a custom game! Please double check your match and try again` });

      let type;
      const state = await ControlPanel.getLeagueState();
      if (state === `COMBINES`) type = GameType.COMBINE;
      else if (state === `REGULAR_SEASON`) type = GameType.SEASON;
      else if (state === `PLAYOFFS`) type = GameType.PLAYOFF;
      else return await interaction.editReply({ content: `The league state enum in the control panel is set incorrectly. Please open a tech ticket.` });

      // save the match to the database
      Games.saveMatch({ id: gameID, tier: tier, type: type });

      // build and then send the embed confirmation
      const embed = new EmbedBuilder({
         author: { name: `VDC Match Submission` },
         description: `Your match was successfully submitted!`,
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
               value: `${tier}\n${type}\n[\`${gameID}\`](${url})`,
               inline: true
            }
         ],
         footer: { text: `Valorant Draft Circuit — Match Result Submissions` }
      });

      logger.matchdrain(`<t:${Math.round(Date.now() / 1000)}:d> <t:${Math.round(Date.now() / 1000)}:T> **Match submission** - __Tier__: \` ${tier} \`, __Type__: \` ${type} \`, __Match ID__: [\` ${gameID} \`](https://tracker.gg/valorant/match/${gameID})`);
      logger.log(`VERBOSE`, `Match submission - Tier: ${tier}, Type: ${type}, Match ID: [${gameID}](https://tracker.gg/valorant/match/${gameID})`);
      return await interaction.editReply({ embeds: [embed] });
   }
};

