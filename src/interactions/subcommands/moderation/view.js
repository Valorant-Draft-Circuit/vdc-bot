// Get a user's modlogs
// Use strict typing
"use strict";

// Require the modules that we need
// const { ModLogs } = require("@prisma/client");
const { prisma } = require("../../../../prisma/prismadb");

// Create the function
async function getModerationLogs(interaction, user)
{
    // Get the player data from the user's id
    const playerID = interaction.message.embeds[0].fields[1].value
    .replaceAll(`\``, ``)
    .split(`\n`)[1];
    const guildMember = await interaction.guild.members.fetch(playerID);

    // maybe something like this?
    // await prisma.ModLogs.findMany({
    //   where: id == playerID
    // })
}

// Export the function
module.exports = {
    view: getModerationLogs
}