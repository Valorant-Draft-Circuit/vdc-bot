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
const { Tier } = require(`@prisma/client`);
const { ApplicationCommandOptionType } = require(`discord.js`);

module.exports = {
    name: `predictions`,
    description: `Create matchday predictions`,
    default_member_permissions: process.env.ENVIRONMENT == `DEV` ? `0x0` : `0x0000000000002000`,
    options: [
        {
            name: `tier`,
            description: `The tier you'd like to make predictions for`,
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: `Prospect`, value: Tier.PROSPECT },
                { name: `Apprentice`, value: Tier.APPRENTICE },
                { name: `Expert`, value: Tier.EXPERT },
                { name: `Mythic`, value: Tier.MYTHIC },
            ]
        },
        {
            name: `matchday`,
            description: `The matchday to create predictions for`,
            type: ApplicationCommandOptionType.Integer,
            required: true,
        }
    ]
}