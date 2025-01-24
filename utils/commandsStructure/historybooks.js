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
    name : `historybooks`,
    description : `View the VDC history books!`,
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
            name: `ui`,
            description: `Get a UI to navigate the history books!`,
            type: ApplicationCommandOptionType.Subcommand,
        }
    ]
}
