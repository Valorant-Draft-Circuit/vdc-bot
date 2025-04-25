const { Tier } = require(`@prisma/client`);
const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `report`,
    description: `Generate reports for the league`,
    contexts: [InteractionContextType.Guild],
    // options: [
    //     {
    //         name: `type`,
    //         description: `The type of report you'd like to generate`,
    //         type: ApplicationCommandOptionType.String,
    //         required: true,
    //         choices: [
    //             { name: `Prospect`, value: Tier.PROSPECT },
    //             { name: `Apprentice`, value: Tier.APPRENTICE },
    //             { name: `Expert`, value: Tier.EXPERT },
    //             { name: `Mythic`, value: Tier.MYTHIC },
    //         ]
    //     }
    // ]
}