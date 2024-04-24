const { ChatInputCommandInteraction } = require(`discord.js`);

module.exports = {

    name: `ping`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        interaction.reply({ content: `Pong!` });
    }
};