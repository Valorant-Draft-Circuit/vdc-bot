const { ButtonInteraction, MessageFlags, EmbedBuilder } = require(`discord.js`);
const { note, warn, mute, unmute, ban, unban, mapban, history } = require(`../subcommands/mod`);
const { ModNavigationOptions } = require(`../../../utils/enums`);
const { hasModAccess } = require(`../../helpers/mod/guards`);

module.exports = {
	id: `modManager`,

	async execute(/** @type ButtonInteraction */ interaction, args) {
		await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

		if (!hasModAccess(interaction.member)) {
			return interaction.editReply(`You don't have the Mod or Admin role and cannot use these buttons!`);
		}

		switch (Number(args)) {
			case ModNavigationOptions.NOTE_CONFIRM:
				return note.confirm(interaction);
			case ModNavigationOptions.WARN_CONFIRM:
				return warn.confirm(interaction);
			case ModNavigationOptions.MUTE_CONFIRM:
				return mute.confirm(interaction);
			case ModNavigationOptions.BAN_CONFIRM:
				return ban.confirm(interaction);
			case ModNavigationOptions.UNMUTE_CONFIRM:
				return unmute.confirm(interaction);
			case ModNavigationOptions.UNBAN_CONFIRM:
				return unban.confirm(interaction);
			case ModNavigationOptions.MAPBAN_CONFIRM:
				return mapban.confirm(interaction);
			case ModNavigationOptions.HISTORY_PREV:
				return history.page(interaction, -1);
			case ModNavigationOptions.HISTORY_NEXT:
				return history.page(interaction, 1);
			case ModNavigationOptions.CANCEL:
				return cancel(interaction);
		}
	},
};

async function cancel(/** @type ButtonInteraction */ interaction) {
	const embed = interaction.message.embeds[0];
	const cancelled = new EmbedBuilder(embed.toJSON());
	cancelled.setDescription(`This action was cancelled.`);
	await interaction.message.edit({ embeds: [cancelled], components: [] });
	return interaction.deleteReply();
}
