const { Team, Player } = require(`../../prisma`);
const { EmbedBuilder, ApplicationCommand } = require("discord.js");

module.exports = {

   name: `sudo`,

   /** Execution script for CommandInteraction 
    * @param {ApplicationCommand} interaction 
    */
   async execute(interaction) {
      await interaction.deferReply();
      const { _hoistedOptions } = interaction.options;

      const user = _hoistedOptions[0].user;
      const team = _hoistedOptions.filter(option => option.name === `team`)[0];
      const status = _hoistedOptions.filter(option => option.name === `status`)[0];
      const contractStatus = _hoistedOptions.filter(option => option.name === `contract-status`)[0];
      const mmr = _hoistedOptions.filter(option => option.name === `mmr`)[0];

      const updateParamaters = {};
      if (team) updateParamaters.team = (await Team.getBy({ name: team.value })).id;
      if (status) updateParamaters.status = status.value;
      if (contractStatus) updateParamaters.contractStatus = contractStatus.value;
      if (mmr) updateParamaters.MMR = mmr.value;

      const playerBefore = await Player.getBy({ discordID: user.id });
      const playerAfter = await Player.updateBy({ userIdentifier: { discordID: user.id }, updateParamaters: updateParamaters });

      console.log(playerAfter)
      // create the base embed
      const embed = new EmbedBuilder({
         author: { name: `Player Database Update` },
         description: `The database has been updated.\n\` Player \` : ${user}\n\`     ID \` : \` ${user.id} \``,
         color: 0xE92929,
         fields: [
            {
               name: `\u200B`,
               value: `\`     Team \` : \n\`   Status \` : \n\` Contract \` : \n\`      MMR \` : \n`,
               inline: true
            },
            {
               name: `Before`,
               value: `${(await Team.getBy({ id: playerBefore.team })).name}\n${playerBefore.status}\n${playerBefore.contractStatus}\n${playerBefore.MMR}`,
               inline: true
            },
            {
               name: `After`,
               value: `${(await Team.getBy({ id: playerAfter.team })).name}\n${playerAfter.status}\n${playerAfter.contractStatus}\n${playerAfter.MMR}`,

               inline: true
            }
         ],
         footer: { text: `Sudo — Player: Update` }
      });

      // create the action row, add the component to it & then editReply with all the dat
      return await interaction.editReply({ embeds: [embed] });
   }
};
