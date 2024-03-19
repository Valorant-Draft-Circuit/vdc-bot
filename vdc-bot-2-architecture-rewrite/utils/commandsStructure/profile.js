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
    name: 'profile',
    description: 'All commands related to user profiles',
    options: [
        {
            name: 'user',
            description: 'The user whose profile to get.',
            type: ApplicationCommandOptionType.Subcommand,
            required: false,
            options: [
                {
                    name: 'user',
                    description: 'The user whose profile to get.',
                    type: ApplicationCommandOptionType.User,
                    required: true,
                }
            ]
        },
        {
            name: 'update',
            description: 'Update your nickname & the database to reflect your new Valorant IGN!',
            type: ApplicationCommandOptionType.Subcommand,
            required: false,
        },
    ]
}