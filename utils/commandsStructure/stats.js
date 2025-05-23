const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `stats`,
    description: `Get a player's stats`,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `match`,
            description: `Get the stats for a specific match`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `url`,
                    description: `The URL of the match`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                }
            ]
        },
        {
            name: `player`,
            description: `Get the aggregate stats for a specific player`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `player`,
                    description: `The player to get stats for`,
                    type: ApplicationCommandOptionType.User,
                    required: true,
                },
                {
                    name: `season`,
                    description: `The season you'd like to see the player's stats for (defaults to current season)`,
                    type: ApplicationCommandOptionType.Integer,
                    required: false,
                }
            ]
        }
    ]
}
