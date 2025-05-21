const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `historybooks`,
    description: `View the VDC history books!`,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `player`,
            description: `View a player's accolades!`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `user`,
                    description: `The player to view`,
                    type: ApplicationCommandOptionType.User,
                    required: true,
                }
            ]
        },
        {
            name: `season`,
            description: `View the accolades by season!`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `season`,
                    description: `The season to view accolades for`,
                    type: ApplicationCommandOptionType.Number,
                    required: true,
                }
            ]
        }
    ]
}
