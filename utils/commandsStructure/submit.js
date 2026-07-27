const { Tier } = require(`@prisma/client`);
const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `submit`,
    description: `Submit a match for a specific level`,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `url`,
            description: `Optional tracker.gg match link. Leave empty to auto-detect your recent match games`,
            type: ApplicationCommandOptionType.String,
            required: false,
        },
        {
            name: `tier`,
            description: `Only needed when submitting a link; auto-detected otherwise`,
            type: ApplicationCommandOptionType.String,
            required: false,
            choices: [
                { name: 'Recruit', value: Tier.RECRUIT },
                { name: `Prospect`, value: Tier.PROSPECT },
                { name: `Apprentice`, value: Tier.APPRENTICE },
                { name: `Expert`, value: Tier.EXPERT },
                { name: `Mythic`, value: Tier.MYTHIC },
            ]
        },
    ]
}