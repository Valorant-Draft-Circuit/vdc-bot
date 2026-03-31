const { MessageFlags } = require(`discord.js`);
const { getQueueConfig } = require(`../../core/queue/queueconfig`);
const { joinQueue, leaveQueue, status } = require(`../subcommands/queue`);

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

		if (!(/true/i).test(process.env.QUEUE_SYSTEM_ENABLED)) {
			return interaction.reply({
				content: `The queue system is currently disabled by environment configuration.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		const subcommand = interaction.options.getSubcommand(false);
		const queueConfig = await getQueueConfig();
		if (subcommand === `leave`) {
			return leaveQueue(interaction, queueConfig);
		}

		if (subcommand === `status`) {
			return status(interaction);
		}

		return joinQueue(interaction, queueConfig);
	},
};
