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
    name: `standings`,
    description: `View tier standings`,
    options: [
        {
            name: `tier`,
            description: `The tier you'd like to see standings for`,
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
            name: `season`,
            description: `The season you'd like to see standings for (defaults to current season)`,
            type: ApplicationCommandOptionType.Integer,
            required: false,
        }
    ]
}