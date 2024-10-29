const { ChatInputCommandInteraction } = require(`discord.js`);

const { updateFranchiseManagement } = require(`../subcommands/league`);


module.exports = {

    name: `league`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply();

        const { _subcommand } = interaction.options;

        switch (_subcommand) {
            case `update-franchise-management`:
                return await updateFranchiseManagement(interaction);
        }
    }
};
