const { prisma } = require(`../../../prisma/prismadb`);
const { StringSelectMenuInteraction } = require(`discord.js`);


module.exports = {

    id: `maphistoryManager`,

    async execute(/** @type StringSelectMenuInteraction */ interaction) {

        const { values } = interaction;

        const matches = await prisma.games.findMany({ where: { matchID: Number(values[0]) }, select: { gameID: true } });

        return await interaction.reply({
            content: `https://tracker.gg/valorant/match/${matches[0].gameID}\nhttps://tracker.gg/valorant/match/${matches[1].gameID}`,
            ephemeral: true
        });
    }
};