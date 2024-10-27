/** @enum {Number} Pull the enums from ApplicationCommandOptionType
 * @option Subcommand
 * @option SubcommandGroup
 * @option String
 * @option Integer
 * @option Boolean,
 * @option User
 * @option Channel
 * @option Role
 * @option Mentionable
 * @option Number
 * @option Attachment
 */
const { ApplicationCommandOptionType, PermissionFlagsBits } = require(`discord.js`);

module.exports = {
    name: "welcome",
    description: "Welcome a player to the league",
    default_member_permissions: PermissionFlagsBits.BanMembers,
    options: [
        {
            name: `single`,
            description: "Welcome a single player to the league",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `player`,
                    description: "The player to welcome to the league",
                    type: ApplicationCommandOptionType.User,
                    required: true,
                }
            ]
        },
        {
            name: `bulk`,
            description: "Welcome players to the league in bulk",
            type: ApplicationCommandOptionType.Subcommand,
        }
    ]
}
