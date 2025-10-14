const { MessageFlags } = require(`discord.js`);
const { getQueueConfig } = require(`../../core/config`);
const { handleAdminCommand } = require(`../subcommands/queue/admin`);

module.exports = {
    name: `queueadmin`,

    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     */
    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: `Queue admin commands must be run from the server.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const subcommand = interaction.options.getSubcommand(true);
        const queueConfig = await getQueueConfig();

        return handleAdminCommand(interaction, queueConfig, subcommand);
    },
};
