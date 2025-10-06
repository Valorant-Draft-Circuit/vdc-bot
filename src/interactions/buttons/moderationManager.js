// Require all discord commands
const { EmbedBuilder, ChatInputCommandInteraction } = require(`discord.js`);

// Require the moderation commands
const { mute } = require(`../subcommands/moderation`);

// Get the NavationOptions enum
const { ModerationNavigationOptions } = require(`../../../utils/enums`);

// Export the id and functions for the moderation manager
module.exports = {
	id: `moderationManager`,

	async execute(/** @type ChatInputCommandInteraction */ interaction, args) {
		await interaction.deferReply({ ephemeral: true }); // defer as early as possible

		switch (Number(args)) {
			//  CONFIRM BUTTONS  ###################################
            case ModerationNavigationOptions.MUTE_CONFIRM:
                return await mute.confirm(interaction);

			//  CANCEL BUTTONS  ####################################
			case ModerationNavigationOptions.CANCEL:
				return await cancel(interaction);

			default:
				return await interaction.editReply(`There was an error. ERR: BTN_MOD_MGR`);
		}
	},
};

async function cancel(/** @type ChatInputCommandInteraction */ interaction) {
	// delete the reply and then edit the original embed to show cancellation confirmation
	await interaction.deleteReply();

	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);

	embedEdits.setDescription(`This operation was cancelled.`);
	embedEdits.setFields([]);

	return await interaction.message.edit({
		embeds: [embedEdits],
		components: [],
	});
}
