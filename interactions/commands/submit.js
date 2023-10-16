module.exports = {

   name: `submit`,

   execute(interaction) {
      const { _subcommand, _hoistedOptions } = interaction.options;
      const tier = _hoistedOptions[2].value;
      const type = _hoistedOptions[0].value;
      const url = _hoistedOptions[1].value;

      const matchID = url.replace(`https://tracker.gg/valorant/match/`, ``);

      interaction.channel.send({content : `${[tier, type, url].join(`\n`)}`})
      interaction.channel.send({content : `MATCH ID: ${matchID}`})


      interaction.reply({ content: `hello` });
   }
};