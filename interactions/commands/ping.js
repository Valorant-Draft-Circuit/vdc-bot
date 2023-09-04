module.exports = {

    name: `ping`,

    execute(client, interaction) {
        interaction.reply({content: `Pong!`});
    }
};