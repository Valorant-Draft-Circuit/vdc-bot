const { ChatInputCommandInteraction } = require(`discord.js`);
const { updateFranchiseManagement, refreshFranchisesChannel, modifyAccolades, requestAwardFinal, requestAwardPickems } = require(`../subcommands/league`);
const { CHANNELS } = require(`../../../utils/enums`);


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
            case `modify-accolades`:
                return await modifyAccolades(interaction);
            case `award-final`:
                return await requestAwardFinal(interaction);
            case `award-pickems`:
                return await requestAwardPickems(interaction);
            default:
                return await interaction.editReply({ content: `That subcommand doesn't exist! Please try again or open a tech ticket!` });
        }
    }
};
