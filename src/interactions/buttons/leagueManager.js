const { EmbedBuilder, ChatInputCommandInteraction, MessageFlags } = require(`discord.js`);
const { confirmAwardFinal, confirmAwardPickems } = require(`../subcommands/league`);

const { LeagueNavigationOptions } = require(`../../../utils/enums`);

module.exports = {
	id: `leagueManager`,

	async execute(/** @type ChatInputCommandInteraction */ interaction, args) {
		await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }); // defer as early as possible

		switch (Number(args)) {
			case LeagueNavigationOptions.AWARD_FINAL_CONFIRM:
				return await confirmAwardFinal(interaction);

			case LeagueNavigationOptions.PICKEM_CONFIRM:
				return await confirmAwardPickems(interaction);

			case LeagueNavigationOptions.CANCEL:
				return await cancel(interaction);

			default:
				return await interaction.editReply(`There was an error. ERR: BTN_LG_MGR`);
		}
	},
};

async function cancel(/** @type ChatInputCommandInteraction */ interaction) {
	await interaction.deleteReply();

	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);

	embedEdits.setDescription(`This operation was cancelled.`);
	embedEdits.setFields([]);

	return await interaction.message.edit({ embeds: [embedEdits], components: [] });
}
