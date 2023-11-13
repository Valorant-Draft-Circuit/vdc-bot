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
    name: "roster",
    description: "See a team's roster",
    options: [
        {
            name: `team`,
            description: "The team who's roster you'd like to see",
            type: ApplicationCommandOptionType.String,
            required: true,
            autocomplete: true
        }
    ]
}