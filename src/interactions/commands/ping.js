module.exports = {

    name: `ping`,

    execute(interaction) {
        interaction.reply({ content: `Pong!` });
    }
};