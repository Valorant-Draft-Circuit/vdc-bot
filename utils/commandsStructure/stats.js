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
    name: "stats",
    description: "Get a player's stats",
    options: [
        {
            name: "user",
            description: "The player to get stats for",
            type: ApplicationCommandOptionType.User,
            required: true
        }
    ]
}
