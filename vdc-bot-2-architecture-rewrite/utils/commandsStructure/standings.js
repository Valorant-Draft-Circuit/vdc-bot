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
    name: "standings",
    description: "View tier standings",
    options: [
        {
            name: `tier`,
            description: "The tier you'd like to see standings for",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: `Prospect`, value: `Prospect` },
                { name: `Apprentice`, value: `Apprentice` },
                { name: `Expert`, value: `Expert` },
                { name: `Mythic`, value: `Mythic` },
            ]
        },
    ]
}