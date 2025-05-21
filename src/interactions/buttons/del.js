const { ButtonInteraction } = require(`discord.js`);
const { ButtonOptions } = require(`../../../utils/enums`);
const { cancelDraft, executeDraft } = require("../subcommands/draft/draftPlayer");

module.exports = {
    id: `del`,

    async execute(/** @type ButtonInteraction */ interaction, args) {
        await interaction.deferReply({ ephemeral: true }); // defer as early as possible

        return await interaction.channel.delete();
    }
};
