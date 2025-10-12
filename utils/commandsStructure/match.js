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
		{
			name: `submit`,
			description: `Submit the Tracker link for the completed match.`,
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: `tracker_url`,
					description: `Tracker.gg match URL.`,
					type: ApplicationCommandOptionType.String,
					required: false,
				},
			],
		},
	],
};
