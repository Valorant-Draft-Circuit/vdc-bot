const { MessageFlags } = require(`discord.js`);

module.exports = {
	name: `match`,

	/**
	 * @param {import('discord.js').ChatInputCommandInteraction} interaction
	 */
	async execute(interaction) {
		if (!interaction.inGuild()) {
			return interaction.reply({
				content: `Match commands must be run from the server.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		const subcommand = interaction.options.getSubcommand(true);

		switch (subcommand) {
			case `cancel`:
				return handleCancel(interaction);
			case `submit`:
				return handleSubmit(interaction);
			default:
				return interaction.reply({
					content: `That match action is not available yet.`,
					flags: MessageFlags.Ephemeral,
				});
		}
	},
};

async function handleCancel(interaction) {
	return interaction.reply({
		content: `Match cancel voting will be enabled soon. For now, please contact a queue admin.`,
		flags: MessageFlags.Ephemeral,
	});
}

async function handleSubmit(interaction) {
	return interaction.reply({
		content: `Match submission via Tracker link is not live yet. Stay tuned!`,
		flags: MessageFlags.Ephemeral,
	});
}
