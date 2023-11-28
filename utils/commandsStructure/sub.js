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
    name: "sub",
    description: "Access transactions commands here!",
    options: [
        {
            name: `tier`,
            description: "The tier you'd like to see available subs for",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: `Prospect`, value: `Prospect` },
                { name: `Apprentice`, value: `Apprentice` },
                { name: `Expert`, value: `Expert` },
                { name: `Mythic`, value: `Mythic` },
            ]
        },
        {
            name: "max-mmr",
            description: "The maximum MMR you'd like to see a sub with",
            type: ApplicationCommandOptionType.Number,
            required: false
        }
    ]
}