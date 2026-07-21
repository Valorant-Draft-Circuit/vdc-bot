const { ButtonInteraction, MessageFlags, PermissionFlagsBits } = require(`discord.js`);
const { ROLES } = require(`../../../utils/enums`);
const { confirmGameCleanup, cancelGameCleanup } = require(`../subcommands/debug/game`);

module.exports = {
	id: `debugGameManager`,

	async execute(/** @type ButtonInteraction */ interaction, args) {
		await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

		const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
		const isTechLead = interaction.member.roles.cache.has(ROLES.OPERATIONS.TECH_LEAD);
		if (!isAdmin && !isTechLead) {
			return interaction.editReply(`You don't have permission to use these buttons!`);
		}

		if (args === `CONFIRM`) return confirmGameCleanup(interaction);
		if (args === `CANCEL`) return cancelGameCleanup(interaction);
	},
};
