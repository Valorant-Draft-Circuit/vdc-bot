const { ApplicationCommandOptionType, InteractionContextType, PermissionFlagsBits } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `welcome`,
    description: `Welcome a player to the league`,
    default_member_permissions: !Boolean(Number(process.env.PROD)) ? `0x0` : PermissionFlagsBits.BanMembers,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `single`,
            description: `Welcome a single player to the league`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `player`,
                    description: `The player to welcome to the league`,
                    type: ApplicationCommandOptionType.User,
                    required: true,
                }
            ]
        },
        {
            name: `bulk`,
            description: `Welcome players to the league in bulk`,
            type: ApplicationCommandOptionType.Subcommand,
        }
    ]
}
