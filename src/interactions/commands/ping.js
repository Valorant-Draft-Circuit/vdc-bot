const { ChatInputCommandInteraction } = require(`discord.js`);

module.exports = {

    name: `ping`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        return await interaction.reply({ content: `Pong!` });
    }
};