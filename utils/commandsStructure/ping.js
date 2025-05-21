const { InteractionContextType } = require(`discord.js`)

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `ping`,
    description: `Ping the bot!`,
    contexts: [InteractionContextType.Guild]

}