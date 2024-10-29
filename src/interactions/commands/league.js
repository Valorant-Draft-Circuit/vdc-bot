const { ChatInputCommandInteraction } = require(`discord.js`);

const { updateFranchiseManagement,refreshFranchisesChannel } = require(`../subcommands/league`);
const { CHANNELS } = require("../../../utils/enums");


module.exports = {

    name: `league`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply();

        const { _subcommand } = interaction.options;

        switch (_subcommand) {
            case `update-franchise-management`:
                return await updateFranchiseManagement(interaction);
            case `refresh-franchises-channel`:
                await refreshFranchisesChannel(interaction);
                return await interaction.editReply(`The <#${CHANNELS.FRANCHISES}> channel has been updated!`)
        }
    }
};
