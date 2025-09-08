const { Tier } = require(`@prisma/client`);
const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `standings`,
    description: `View tier standings`,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `tier`,
            description: `The tier you'd like to see standings for`,
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
                { name: 'Recruit', value: Tier.RECRUIT },
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