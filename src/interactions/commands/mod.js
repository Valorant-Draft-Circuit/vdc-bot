const { ChatInputCommandInteraction } = require(`discord.js`);
const { note, warn, history, mute, unmute, ban, unban } = require(`../subcommands/mod`);
const { hasModAccess } = require(`../../helpers/mod/guards`);

module.exports = {
	name: `mod`,

	async execute(/** @type ChatInputCommandInteraction */ interaction) {
		await interaction.deferReply();

		if (!hasModAccess(interaction.member)) {
			return interaction.editReply(`You don't have the Mod or Admin role and cannot use this command!`);
		}

		const { _subcommand } = interaction.options;
		const targetUser = interaction.options.getUser(`user`);
		const reason = interaction.options.getString(`reason`) ?? `No reason provided.`;
		const rules = interaction.options.getString(`rules`);

		switch (_subcommand) {
			case `note`:
				return note.request(interaction, targetUser, reason);
			case `warn`:
				return warn.request(interaction, targetUser, interaction.options.getBoolean(`formal`), rules, reason);
			case `mute`:
				return mute.request(interaction, targetUser, interaction.options.getString(`duration`), rules, reason);
			case `ban`:
				return ban.request(interaction, targetUser, interaction.options.getString(`duration`), rules, reason);
			case `unmute`:
				return unmute.request(interaction, targetUser, reason);
			case `unban`:
				return unban.request(interaction, targetUser, reason);
			case `history`:
				return history.history(interaction, targetUser);
		}
	},
};
