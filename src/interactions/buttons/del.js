const { ButtonInteraction } = require(`discord.js`);
const { ButtonOptions } = require(`../../../utils/enums`);
const { cancelDraft, executeDraft } = require("../subcommands/draft/draftPlayer");
const { prisma } = require("../../../prisma/prismadb");

module.exports = {
    id: `del`,

    async execute(/** @type ButtonInteraction */ interaction, args) {
        await interaction.deferReply({ ephemeral: true }); // defer as early as possible
        await prisma.mapBans.deleteMany({ where: { matchID: 719 } });
        return await interaction.channel.delete();
    }
};
