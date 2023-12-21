const { Team, Player } = require(`../../prisma`);
const { EmbedBuilder, ApplicationCommand } = require("discord.js");
const { PlayerStatusCode, ContractStatus } = require("../../utils/enums");

module.exports = {

   name: `sudo`,

   /** Execution script for CommandInteraction 
    * @param {ApplicationCommand} interaction 
    */
   async execute(interaction) {
      await interaction.deferReply();
      const { _hoistedOptions } = interaction.options;

      if (_hoistedOptions.length === 1) {
         const errorEmbed = new EmbedBuilder({
            author: { name: `ERROR : Insufficent Arguments` },
            description: `You didn't provide any arguments.`,
            color: 0xE92929,
            footer: { text: `Sudo — Player: Update` }
         });
         return await interaction.editReply({ embeds: [errorEmbed] });
      }

      const user = _hoistedOptions[0].user;
      const team = _hoistedOptions.filter(option => option.name === `team`)[0];
      const status = _hoistedOptions.filter(option => option.name === `status`)[0];
      const contractStatus = _hoistedOptions.filter(option => option.name === `contract-status`)[0];
      // const mmr = _hoistedOptions.filter(option => option.name === `mmr`)[0];


      console.log(_hoistedOptions)

      const updateParamaters = {};
      if (team) updateParamaters.team = (await Team.getBy({ name: team.value })).id;
      if (status) updateParamaters.status = status.value;
      if (contractStatus) updateParamaters.contractStatus = contractStatus.value;
      // if (mmr) updateParamaters.MMR = mmr.value;

      const playerBefore = await Player.getBy({ discordID: user.id });
      const playerAfter = await Player.updateBy({ userIdentifier: { discordID: user.id }, updateParamaters: updateParamaters }).catch(e => e);

      if (playerAfter instanceof Error) {
         const errorEmbed = new EmbedBuilder({
            author: { name: `ERROR : Player Database Update` },
            description: `The database was not updated. The error is captured below:\`\`\`js\n${playerAfter.stack}\n\`\`\``,
            color: 0xE92929,
            footer: { text: `Sudo — Player: Update` }
         });
         return await interaction.editReply({ embeds: [errorEmbed] });
      }

      const beforeData = [
         playerBefore.team ? (await Team.getBy({ id: playerBefore.team })).name: `NO TEAM`,
         Object.keys(PlayerStatusCode).find(key => PlayerStatusCode[key] === playerBefore.status),
         Object.keys(ContractStatus).find(key => ContractStatus[key] === playerBefore.contractStatus),
         // playerBefore.MMR_Player_MMRToMMR.mmr_overall
      ];

      const afterData = [
         playerAfter.team ? (await Team.getBy({ id: playerAfter.team })).name : `NO TEAM`,
         Object.keys(PlayerStatusCode).find(key => PlayerStatusCode[key] === playerAfter.status),
         Object.keys(ContractStatus).find(key => ContractStatus[key] === playerAfter.contractStatus),
         // playerAfter.MMR_Player_MMRToMMR.mmr_overall
      ];

      // create the base embed
      const embed = new EmbedBuilder({
         author: { name: `Player Database Update` },
         description: `The database has been updated.\n\` Player \` : ${user}\n\`     ID \` : \` ${user.id} \``,
         color: 0xE92929,
         fields: [
            {
               name: `\u200B`,
               // value: `\`     Team \` : \n\`   Status \` : \n\` Contract \` : \n\`      MMR \` : \n`,
               value: `\`     Team \` : \n\`   Status \` : \n\` Contract \` : `,
               inline: true
            },
            {
               name: `Before`,
               value: beforeData.join(`\n`),
               inline: true
            },
            {
               name: `After`,
               value: afterData.join(`\n`),

               inline: true
            }
         ],
         footer: { text: `Sudo — Player: Update` }
      });
      // create the action row, add the component to it & then editReply with all the dat
      return await interaction.editReply({ embeds: [embed] });
   }
};
