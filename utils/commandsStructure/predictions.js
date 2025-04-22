const { Tier } = require(`@prisma/client`);
const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `predictions`,
    description: `Create matchday predictions`,
    default_member_permissions: !Boolean(Number(process.env.PROD)) ? `0x0` : `0x0000000000002000`,
    contexts: [InteractionContextType.Guild],
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