const { ContractStatus } = require("@prisma/client");
const { prisma } = require("../../../../prisma/prismadb");

async function offseasonReset(/** @type ChatInputCommandInteraction */ interaction) {
    progress = [];
    progress.push('Starting offseason reset...');
    await interaction.editReply(progress.join('\n'));
    // 1. UNCAPTAIN UNIR
    progress.push('1. Removing captains and inactive reserve players...');
    await interaction.editReply(progress.join('\n'));
    const captains = await prisma.user.findMany({
        where: {
            Captain: { isNot: null },
        },
        include: { 
            Captain: true,
            Status: true,
         },
    })
    const inactiveReserve = await prisma.user.findMany({
        where: {
            Status: {
                contractStatus: ContractStatus.INACTIVE_RESERVE,
            },
        },
        include: {
            Status: true,
        }
    });
    progress.push(`  - Found ${captains.length} captain${captains.length !== 1 ? 's' : ''}.`);
    progress.push(`  - Found ${inactiveReserve.length} inactive reserve player${inactiveReserve.length !== 1 ? 's' : ''}.`);
    await interaction.editReply(progress.join('\n'));
    // 2. UPDATE CONTRACTS
    // 3. REMOVE FLAGS
    // 4. UPDATE EVERYONE'S STATUS TO UNREGISTERED
    // 5. UPDATE EVERYONE'S ROLES IN DISCORD
    progress.push('Done!');
    return await interaction.editReply(progress.join('\n'));
}

module.exports = { offseasonReset };