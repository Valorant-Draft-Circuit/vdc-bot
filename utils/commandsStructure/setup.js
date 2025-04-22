const { ApplicationCommandOptionType, InteractionContextType, PermissionFlagsBits } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `setup`,
    description: `Base command to setup/execute various one-time functionalities`,
    default_member_permissions: PermissionFlagsBits.BanMembers,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `activity-check`,
            description: `Setup activity check`,
            type: ApplicationCommandOptionType.Subcommand,
        }
    ]
}
