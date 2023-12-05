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
            name: `match`,
            description: "Get the stats for a specific match",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'url',
                    description: 'The URL of the match',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                }
            ]
        }
    ]
}
