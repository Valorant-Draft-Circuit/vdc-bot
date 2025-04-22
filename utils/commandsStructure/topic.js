const { InteractionContextType, PermissionFlagsBits } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `topic`,
    description: `Send the channel's topic in chat.`,
        default_member_permissions: !Boolean(Number(process.env.PROD)) ? `0x0` : PermissionFlagsBits.ManageMessages,
    contexts: [InteractionContextType.Guild],
}
