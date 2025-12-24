const { ChatInputCommandInteraction } = require(`discord.js`);
const { prisma } = require("../../../../prisma/prismadb");
// const { CHANNELS } = require("../../../../utils/enums/channels");

async function resetMapBan(/** @type ChatInputCommandInteraction */ interaction) {
    const { _hoistedOptions } = interaction.options;
    const matchID = _hoistedOptions[0].value;

    //TODO: Check if the command is being run in a mapban channel then autofill matchID?  Made some boilerplate for this below

    // const channel = interaction.channel;
    // if (channel.parent?.id !== CHANNELS.CATEGORIES.MAPBANS) {
    //     return interaction.editReply(`This command can only be run inside a mapban channel.`);
    // }

    await interaction.editReply(`Fetching map bans for match ID: ${matchID}`);

    const match = await prisma.Matches.findUnique({ where: { matchID } });
    if (!match) {
        return interaction.editReply(`No match found with ID: ${matchID}`);
    }

    const mapBans = await prisma.MapBans.findMany({ where: { matchID } });
    if (!mapBans || mapBans.length === 0) {
        return interaction.editReply(`No map bans found for match ID: ${matchID}`);
    }

    await prisma.MapBans.deleteMany({ where: { matchID } });

    const channel = interaction.channel;
    const newChannelName = channel.name.replace(/bans/i, "old");
    await channel.setName(newChannelName);

    return interaction.editReply(`Map bans for match ID: \`${matchID}\` have been reset.`);
}
module.exports = { resetMapBan };