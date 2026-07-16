const { ButtonInteraction, MessageFlags, PermissionFlagsBits } = require(`discord.js`);
const { confirmGameCleanup, cancelGameCleanup } = require(`../subcommands/debug/game`);

module.exports = {
	id: `debugGameManager`,

	async execute(/** @type ButtonInteraction */ interaction, args) {
		await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

		if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
			return interaction.editReply(`You don't have permission to use these buttons!`);
		}

		if (args === `CONFIRM`) return confirmGameCleanup(interaction);
		if (args === `CANCEL`) return cancelGameCleanup(interaction);
	},
};
