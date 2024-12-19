const { StringSelectMenuInteraction } = require(`discord.js`);


module.exports = {

    id: `maphistoryManager`,

    async execute(/** @type StringSelectMenuInteraction */ interaction) {

        const { values } = interaction;

        return await interaction.reply({
            content: `https://tracker.gg/valorant/match/${values[0]}`,
            ephemeral: true
        });
    }
};