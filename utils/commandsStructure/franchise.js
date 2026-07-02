const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);
const { readCacheJson } = require(`../readCacheJson.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `franchise`,
    description: `Get info about a franchise`,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `info`,
            description: `Get information about a franchise`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `franchise`,
                    description: `The franchise's info you're looking for`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: franchiseChoices()
                }
            ]
        },
        {
            name: `update-description`,
            description: `Update the description for your franchise`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `description`,
                    description: `Upload a .txt file with your franchise's new description`,
                    type: ApplicationCommandOptionType.Attachment,
                    required: true,
                }
            ]
        },
    ]
}

function franchiseChoices() {
    const franchiseData = readCacheJson(`franchises.json`);
    const franchiseOptions = [];

    franchiseData.forEach(franchise => {
        franchiseOptions.push({
            name: `${franchise.slug} — ${franchise.name}`,
            value: franchise.name,
        })
    });

    return franchiseOptions;
}
