const { Tier } = require(`@prisma/client`);
const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `sub`,
    description: `View FA/RFAs here!`,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `tier`,
            description: `The tier you'd like to see available subs for`,
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
            name: `max-mmr`,
            description: `The maximum MMR you'd like to see a sub with`,
            type: ApplicationCommandOptionType.Number,
            required: false
        }
    ]
}