const { MessageFlags } = require(`discord.js`);
const { getQueueConfig } = require(`../../core/config`);
const { joinQueue, leaveQueue, handleAdminCommand } = require(`../subcommands/queue`);

module.exports = {
	name: `queue`,

	/**
	 * @param {import('discord.js').ChatInputCommandInteraction} interaction
	 */
	async execute(interaction) {
		if (!interaction.inGuild()) {
			return interaction.reply({
				content: `The queue system can only be used inside the server.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		const subcommandGroup = interaction.options.getSubcommandGroup(false);
		const subcommand = interaction.options.getSubcommand(false);
		const queueConfig = await getQueueConfig();

		if (subcommandGroup === `admin`) {
			return handleAdminCommand(interaction, queueConfig, subcommand);
		}

		if (subcommand === `leave`) {
			return leaveQueue(interaction, queueConfig);
		}

		return joinQueue(interaction, queueConfig);
	},
};
