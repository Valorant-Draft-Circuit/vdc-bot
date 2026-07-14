const { ChatInputCommandInteraction } = require(`discord.js`);
const { note, warn, history, mute, unmute, ban, unban, mapban, unmapban, help, log } = require(`../subcommands/mod`);
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
		const appealable = interaction.options.getBoolean(`appealable`) ?? true;

		switch (_subcommand) {
			case `note`:
				return note.request(interaction, targetUser, reason);
			case `warn`:
				return warn.request(interaction, targetUser, interaction.options.getBoolean(`formal`), rules, reason);
			case `mute`:
				return mute.request(interaction, targetUser, interaction.options.getString(`duration`), rules, reason, appealable);
			case `ban`:
				return ban.request(interaction, targetUser, interaction.options.getString(`duration`), rules, reason, appealable);
			case `mapban`:
				return mapban.request(interaction, targetUser, interaction.options.getInteger(`maps`), rules, reason, appealable);
			case `unmute`:
				return unmute.request(interaction, targetUser, reason);
			case `unban`:
				return unban.request(interaction, targetUser, reason);
			case `unmapban`:
				return unmapban.request(interaction, targetUser, reason);
			case `history`:
				return history.history(interaction, targetUser);
			case `help`:
				return help.help(interaction);
			case `log`:
				return log.log(interaction, interaction.options.getInteger(`id`));
		}
	},
};
