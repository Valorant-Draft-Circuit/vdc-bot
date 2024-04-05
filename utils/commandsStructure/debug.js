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
const { ApplicationCommandOptionType } = require(`discord.js`);

module.exports = {
    name: "debug",
    description: "Access debug commands here!",
    default_member_permissions: `0x0000000000002000`,
    options: [
        {
            name: "user",
            description: "Get all information about a user",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "player",
                    description: "The player to debug",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
            ],
        },
        {
            name: "report",
            description: "Generate a report for all player's LeagueStatuses",
            type: ApplicationCommandOptionType.Subcommand,
        },
    ]
}