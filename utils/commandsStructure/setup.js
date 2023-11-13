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
    name: "setup",
    description: "Base command to setup/execute various one-time functionalities",
    default_member_permissions: PermissionFlagsBits.BanMembers,
    options: [
        {
            name: `activity-check`,
            description: "Setup activity check",
            type: ApplicationCommandOptionType.Subcommand,
        }
    ]
}
