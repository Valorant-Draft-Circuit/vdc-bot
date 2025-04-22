const { InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `topic`,
    description: `Send the channel's topic in chat.`,
    default_member_permissions: `0x0000000000002000`,
    contexts: [InteractionContextType.Guild],
}
