const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
	name: `match`,
	description: `Manage your active queue matches.`,
	contexts: [InteractionContextType.Guild],
	options: [
		{
			name: `cancel`,
			description: `Start a vote to cancel the current match.`,
			type: ApplicationCommandOptionType.Subcommand,
		},
	],
};
