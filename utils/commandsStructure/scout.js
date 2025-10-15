const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `scout`,
    description: `Scout utilities: follow players to receive DM notifications when they queue/match.`,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `follow`,
            description: `Follow a player to receive notifications when they queue/match.`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `player`,
                    description: `Player to follow (Discord user).`,
                    type: ApplicationCommandOptionType.User,
                    required: true,
                },
            ],
        },
        {
            name: `unfollow`,
            description: `Stop following a player.`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `player`,
                    description: `Player to unfollow (Discord user).`,
                    type: ApplicationCommandOptionType.User,
                    required: true,
                },
            ],
        },
        {
            name: `list`,
            description: `List players you're currently following.`,
            type: ApplicationCommandOptionType.Subcommand,
        },
    ],
};
