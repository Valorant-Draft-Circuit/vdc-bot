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
    name: 'submit',
    description: 'Submit a match for a specific level',
    options: [
        {
            name: 'tier',
            description: 'The tier of the match',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                {
                    name: 'Prospect',
                    value: 'PROSPECT'
                },
                {
                    name: 'Apprentice',
                    value: 'APPRENTICE'
                },
                {
                    name: 'Expert',
                    value: 'EXPERT'
                },
                {
                    name: 'Mythic',
                    value: 'MYTHIC'
                },
                {
                    name: 'Mixed',
                    value: 'MIXED'
                }
            ]
        },
        {
            name: 'type',
            description: 'The type of match played',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                {
                    name: 'Combine',
                    value: 'COMBINE'
                },
                {
                    name: 'Season',
                    value: 'SEASON'
                },
                {
                    name: 'Playoffs',
                    value: 'PLAYOFF'
                },
            ]
        },
        {
            name: 'url',
            description: 'The URL of the match',
            type: ApplicationCommandOptionType.String,
            required: true,
        },
    ]
}