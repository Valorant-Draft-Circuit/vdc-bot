const { ButtonInteraction, MessageFlags } = require(`discord.js`);
const { ButtonOptions } = require(`../../../utils/enums`);
const { cancelDraft, executeDraft } = require("../subcommands/draft/draftPlayer");

module.exports = {
    id: `draftManager`,

    async execute(/** @type ButtonInteraction */ interaction, args) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral }); // defer as early as possible

        switch (Number(args)) {
            case ButtonOptions.DRAFT_CANCEL: {
                return await cancelDraft(interaction);
            }
            case ButtonOptions.DRAFT_CONFIRM: {
                return await executeDraft(interaction);
            }
        }
    }
};
