const { InteractionContextType } = require(`discord.js`)

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `active`,
    description: `Run this command to perform the activity check!`,
    contexts: [InteractionContextType.Guild]
}
