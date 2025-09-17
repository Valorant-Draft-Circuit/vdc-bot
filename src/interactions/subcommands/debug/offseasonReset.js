const { ContractStatus } = require("@prisma/client");
const { prisma } = require("../../../../prisma/prismadb");
const { Transaction, Player, Roles, Team } = require("../../../../prisma");
const { ROLES, CHANNELS } = require("../../../../utils/enums");
const { EmbedBuilder } = require("discord.js");

async function offseasonReset(/** @type ChatInputCommandInteraction */ interaction) {
    const expiringPlayers = await prisma.user.findMany({
        where: {
            Status: {
                contractStatus: ContractStatus.SIGNED,  
                contractRemaining: 0,
            },
        },
    });
    if (expiringPlayers.length > 0) {
        interaction.editReply(`**WARNING:** There are still players with expired contracts! Please ensure that all players with expired contracts have been cut from their teams before running the offseason reset!`);
        return;
    }
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
            Accounts: true,
            PrimaryRiotAccount: true,
         },
    })
    const inactiveReserves = await prisma.user.findMany({
        where: {
            Status: {
                contractStatus: ContractStatus.INACTIVE_RESERVE,
            },
        },
        include: {
            Status: true,
            Accounts: true,
            PrimaryRiotAccount: true,
            Team: true,
        }
    });
    progress.push(`  - Found ${captains.length} captain${captains.length !== 1 ? 's' : ''}.`);
    console.log(captains);
    for (let i = 0; i < captains.length; i++) {
        const captain = captains[i];
        progress.push(`      - Removing captain from ${captain.name} (${captain.id})...`);
        await interaction.editReply(progress.join('\n'));
        await removeCaptain(interaction, captain);
        progress.pop();
        progress.push(`      - ✅ Removed captain from ${captain.name} (${captain.id}).`);
        await interaction.editReply(progress.join('\n'));
    }
    progress.splice((captains.length + 1) * -1, 1, `  - ✅ Removed all ${captains.length} captains.`);
    progress.push(`  - Found ${inactiveReserves.length} inactive reserve player${inactiveReserves.length !== 1 ? 's' : ''}.`);
    for (let i = 0; i < inactiveReserves.length; i++) {
        const inactiveReserve = inactiveReserves[i];
        progress.push(`      - Removing inactive reserve status from ${inactiveReserve.name} (${inactiveReserve.id})...`);
        await interaction.editReply(progress.join('\n'));
        await removeInactiveReserve(interaction, inactiveReserve);
        progress.pop();
        progress.push(`      - ✅ Removed inactive reserve status from ${inactiveReserve.name} (${inactiveReserve.id}).`);
        await interaction.editReply(progress.join('\n'));
    }
    progress.splice((inactiveReserves.length + 1) * -1, 1, `  - ✅ Removed all ${inactiveReserves.length} inactive reserve players.`);
    await interaction.editReply(progress.join('\n'));
    // 2. UPDATE CONTRACTS
    progress.push('2. Degrading all player contracts by a season...');
    await interaction.editReply(progress.join('\n'));
    const contractedPlayers = await prisma.user.findMany({
        where: {
            Status: {
                contractStatus: ContractStatus.SIGNED,
                contractRemaining: {
                    gt: 0,
                },
            },
        },
        include: {
            Status: true,
        },
    })
    progress.push(`  - Found ${contractedPlayers.length} contracted player${contractedPlayers.length !== 1 ? 's' : ''}.`);
    progress.push('  - Degrading contracts...');
    await interaction.editReply(progress.join('\n'));
    await prisma.status.updateMany({
        where: {
            contractStatus: ContractStatus.SIGNED,
            contractRemaining: {
                gt: 0,
            },
        },
        data: {
            contractRemaining: {
                decrement: 1,
            },
        },
    });
    progress.push('  - ✅ Degraded all contracts by a season.');
    await interaction.editReply(progress.join('\n'));
    // check for players whose contracts have expired
    const expiredPlayers = await prisma.user.findMany({
        where: {
            Status: {
                contractStatus: ContractStatus.SIGNED,  
                contractRemaining: 0,
            },
        },
        include: {
            Status: true,
        },
    });
    progress.push(`  - Found ${expiredPlayers.length} player${expiredPlayers.length !== 1 ? 's' : ''} with expired contracts.`);
    // 3. REMOVE FLAGS
    // 4. UPDATE EVERYONE'S STATUS TO UNREGISTERED
    // 5. UPDATE EVERYONE'S ROLES IN DISCORD
    progress.push('Done!');
    return await interaction.editReply(progress.join('\n'));
}

async function removeCaptain(interaction, captain) {
    // stuff to check before removing a captain
    // make sure theyre in the server
    // make sure they able to be managed by the bot
    const playerDiscordID = captain.Accounts.find(a => a.provider === `discord`).providerAccountId;
    const guildMember = await interaction.guild.members.fetch(playerDiscordID);
    const team = await Team.getBy({ id: captain.Captain.id });
    console.log(team);
    // Remove the database role of captain
    await Player.modifyRoles({ userID: captain.id }, 'REMOVE', [Roles.LEAGUE_CAPTAIN]);
    // uncaptain the player & ensure that the player's Captain property is now null
    const updatedTeam = await Transaction.toggleCaptain({ userID: captain.id, toggle: 'REMOVE', teamID: captain.Captain.id});
    if (updatedTeam.captain !== null) return interaction.editReply(`There was an error removing ${captain.name} as a captain.`);
    // Remove the discord role of captain from the player
    await guildMember.roles.remove(ROLES.LEAGUE.CAPTAIN);
    // create transactions embed
    const announcement = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		thumbnail: {
			url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${team.Franchise.Brand.logo}`,
		},
        description: `${guildMember} (${captain.PrimaryRiotAccount.riotIGN.split('#')[0]}) is no longer the captain of ${updatedTeam.name}`,
		color: 0xe92929,
		footer: { text: `Transactions — Team Captain` },
		timestamp: Date.now(),
	});
    const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
    return await transactionsChannel.send({ embeds: [announcement] });
}

async function removeInactiveReserve(interaction, inactiveReserve) {
    // stuff to check before removing a captain
    // make sure theyre in the server
    // make sure they able to be managed by the bot
    const playerDiscordID = inactiveReserve.Accounts.find(a => a.provider === `discord`).providerAccountId;
    const guildMember = await interaction.guild.members.fetch(playerDiscordID);
    const team = await Team.getBy({ id: inactiveReserve.team });
    console.log(team);
    // Remove the database role of captain
    await Player.modifyRoles({ userID: inactiveReserve.id }, 'REMOVE', [Roles.LEAGUE_CAPTAIN]);
    // uncaptain the player & ensure that the player's Captain property is now null
    const player = await Transaction.toggleInactiveReserve({ playerID: inactiveReserve.id, toggle: 'REMOVE' });
    if (player.Status.contractStatus === ContractStatus.INACTIVE_RESERVE) return interaction.editReply(`There was an error removing ${inactiveReserve.name} from inactive reserve.`);
    // Remove the discord role of captain from the player
    await guildMember.roles.remove(ROLES.LEAGUE.INACTIVE_RESERVE);
    // create transactions embed
    const announcement = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		thumbnail: {
			url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${team.Franchise.Brand.logo}`,
		},
        description: `${guildMember} (${inactiveReserve.PrimaryRiotAccount.riotIGN.split('#')[0]}) is no longer on Inactive Reserve`,
		color: 0xe92929,
		footer: { text: `Transactions — Inactive Reserve` },
		timestamp: Date.now(),
	});
    const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
    return await transactionsChannel.send({ embeds: [announcement] });
}

module.exports = { offseasonReset };