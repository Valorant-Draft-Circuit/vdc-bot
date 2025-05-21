const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `profile`,
    description: `All commands related to user profiles`,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `user`,
            description: `The user whose profile to get.`,
            type: ApplicationCommandOptionType.Subcommand,
            required: false,
            options: [
                {
                    name: `user`,
                    description: `The user whose profile to get.`,
                    type: ApplicationCommandOptionType.User,
                    required: true,
                }
            ]
        },
        {
            name: `update`,
            description: `Update your nickname & the database to reflect your new Valorant IGN!`,
            type: ApplicationCommandOptionType.Subcommand,
            required: false,
        },
    ]
}