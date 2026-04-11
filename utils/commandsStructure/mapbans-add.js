const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `mapbans-add`,
    description: `Add a user to the current mapbans channel.`,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `user`,
            description: `The user to add to this mapbans channel.`,
            type: ApplicationCommandOptionType.User,
            required: true,
        }
    ]
};
