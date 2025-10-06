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
    name: `moderation`,
    description: `Access moderation commands here!`,
    options: [
        {
            name: `ban`,
            description: `Ban a player in the VDC Main Server`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: `The player to ban`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: `reason`,
                    description: `Why is this player being banned? Be descriptive, and include the rulebreak in this.`,
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        },
        {
            name: `mute`,
            description: `Mute a player in the VDC Main Server`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: 'user',
                    description: `The player to mute`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: `length`,
                    description: `How long to mute the player for`,
                    type: ApplicationCommandOptionType.String,
                    required: true
                },
                {
                    name: `reason`,
                    description: `Why is this player being muted? Be descriptive, and include the rulebreak in this.`,
                    type: ApplicationCommandOptionType.String,
                    required: true
                }
            ]
        }
    ]
}