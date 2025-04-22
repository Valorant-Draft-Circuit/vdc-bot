const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `roster`,
    description: `See a team's roster`,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `team`,
            description: `The team who's roster you'd like to see`,
            type: ApplicationCommandOptionType.String,
            required: true,
            autocomplete: true
        }
    ]
}