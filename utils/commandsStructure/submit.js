const { Tier } = require(`@prisma/client`);
const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `submit`,
    description: `Submit a match for a specific level`,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `tier`,
            description: `The tier of the match`,
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
            name: `url`,
            description: `The URL of the match`,
            type: ApplicationCommandOptionType.String,
            required: true,
        },
    ]
}