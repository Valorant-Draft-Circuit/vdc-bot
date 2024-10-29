const { ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } = require(`discord.js`);
const { Franchise, Player } = require(`../../../../prisma`);
const { prisma } = require("../../../../prisma/prismadb");
const { ROLES, CHANNELS } = require("../../../../utils/enums");

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

const devTransactionsChannel = `1300688313988022272`;


async function updateFranchiseManagement(/** @type ChatInputCommandInteraction */ interaction) {
    const { _hoistedOptions } = interaction.options;

    // command params
    const operation = _hoistedOptions.find(o => o.name == `operation`).value;
    const franchiseName = _hoistedOptions.find(o => o.name == `franchise`).value;
    const type = _hoistedOptions.find(o => o.name == `type`).value;
    const guildMember = _hoistedOptions.find(o => o.name == `player`).member;

    // check player
    const player = await Player.getBy({ discordID: guildMember.user.id });
    if (player === null) return interaction.editReply(`This player doesn't exist!`);

    // check franchise management
    const franchise = await Franchise.getBy({ name: franchiseName });
    const franchiseManagementIDs = [
        franchise.GM?.Accounts.find(a => a.provider == `discord`).providerAccountId,
        franchise.AGM1?.Accounts.find(a => a.provider == `discord`).providerAccountId,
        franchise.AGM2?.Accounts.find(a => a.provider == `discord`).providerAccountId,
        franchise.AGM3?.Accounts.find(a => a.provider == `discord`).providerAccountId
    ].filter(v => v !== undefined);


    if (operation == `remove`) {
        if (!franchiseManagementIDs.includes(guildMember.user.id)) return await interaction.editReply(`This player is not a member of franchise management and cannot be removed from this franchise!`);

        if (type == `GM`) {
            await prisma.franchise.update({ where: { id: franchise.id }, data: { gmID: null } });

            await updateTransactionsPerms(interaction, guildMember, franchise, `REMOVE`);
            await guildMember.roles.remove([ROLES.OPERATIONS.GM]);

            // create the base embed
            const announcement = new EmbedBuilder({
                author: { name: `Franchise Management Update` },
                description: `${guildMember} (${player.PrimaryRiotAccount.riotIGN}) is no longer the General Manager for ${franchise.name}`,
                thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchise.Brand.logo}` },
                color: 0xE92929,
                footer: { text: `Franchise Management — Remove` },
                timestamp: Date.now(),
            });

            const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
            await transactionsChannel.send({ embeds: [announcement] });


            return await interaction.editReply(`This operation is complete. ${guildMember} is no longer the general manager for ${franchise.name}!`);
        } else {
            let agmNumber = 0;
            if (franchise.agm1ID == player.id) agmNumber = 1;
            else if (franchise.agm2ID == player.id) agmNumber = 2;
            else if (franchise.agm3ID == player.id) agmNumber = 3;
            else return await interaction.editReply(`This player is not an AGM of this franchise`);


            await prisma.franchise.update({ where: { id: franchise.id }, data: { [`agm${agmNumber}ID`]: null } });

            await updateTransactionsPerms(interaction, guildMember, franchise, `REMOVE`);
            await guildMember.roles.remove([ROLES.OPERATIONS.AGM]);

            // create the base embed
            const announcement = new EmbedBuilder({
                author: { name: `Franchise Management Update` },
                description: `${guildMember} (${player.PrimaryRiotAccount.riotIGN}) is no longer an Assistant General Manager for ${franchise.name}`,
                thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchise.Brand.logo}` },
                color: 0xE92929,
                footer: { text: `Franchise Management — Remove` },
                timestamp: Date.now(),
            });

            const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
            await transactionsChannel.send({ embeds: [announcement] });


            return await interaction.editReply(`This operation is complete. ${guildMember} is no longer an assistant general manager for ${franchise.name}!`);
        }

    } else {
        const allGMIDs = (await prisma.franchise.findMany({
            where: { active: true },
            select: { gmID: true, agm1ID: true, agm2ID: true, agm3ID: true }
        })).map(gms => Object.values(gms)).flat().filter(id => id != null);

        if (allGMIDs.includes(player.id)) return await interaction.editReply(`This player is already in franchise management! Please remove them from their current position to add them to their new position!`);

        if (type == `GM`) {
            if (franchise.gmID != null) return await interaction.editReply(`There is already a general manager for this ${franchise.name}! Please remove them before adding ${guildMember} as the new general manager!`);

            await prisma.franchise.update({ where: { id: franchise.id }, data: { gmID: player.id } });

            await updateTransactionsPerms(interaction, guildMember, franchise, `ADD`);
            await guildMember.roles.add([ROLES.OPERATIONS.GM]);

            // update nickname
            const playerTag = player.PrimaryRiotAccount.riotIGN.split(`#`)[0];
            const accolades = guildMember.nickname?.match(emoteregex);
            guildMember.setNickname(`${franchise.slug} | ${playerTag} ${accolades ? accolades.join(``) : ``}`);

            // create the base embed
            const announcement = new EmbedBuilder({
                author: { name: `Franchise Management Update` },
                description: `${guildMember} (${player.PrimaryRiotAccount.riotIGN}) is now the General Manager for ${franchise.name}`,
                thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchise.Brand.logo}` },
                color: 0xE92929,
                footer: { text: `Franchise Management — Add` },
                timestamp: Date.now(),
            });

            const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
            await transactionsChannel.send({ embeds: [announcement] });

            return await interaction.editReply(`This operation is complete. ${guildMember} was set as the general manager for ${franchise.name}!`);

        } else {
            if (franchise.agm1ID != null && franchise.agm2ID != null && franchise.agm3ID != null) return await interaction.editReply(`There are no assistant general manager slots available for this ${franchise.name}! Please remove one before adding ${guildMember} as a new assistant general manager!`);

            let openSlot = 0;
            if (franchise.agm1ID == null) openSlot = 1;
            else if (franchise.agm2ID == null) openSlot = 2;
            else if (franchise.agm3ID == null) openSlot = 3;
            else return await interaction.editReply(`no open slots`);

            await prisma.franchise.update({ where: { id: franchise.id }, data: { [`agm${openSlot}ID`]: player.id } });

            await updateTransactionsPerms(interaction, guildMember, franchise, `ADD`);
            await guildMember.roles.add([ROLES.OPERATIONS.AGM]);

            // update nickname
            const playerTag = player.PrimaryRiotAccount.riotIGN.split(`#`)[0];
            const accolades = guildMember.nickname?.match(emoteregex);
            guildMember.setNickname(`${franchise.slug} | ${playerTag} ${accolades ? accolades.join(``) : ``}`);

            // // create the base embed
            const announcement = new EmbedBuilder({
                author: { name: `Franchise Management Update` },
                description: `${guildMember} (${player.PrimaryRiotAccount.riotIGN}) is now an Assistant General Manager for ${franchise.name}`,
                thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchise.Brand.logo}` },
                color: 0xE92929,
                footer: { text: `Franchise Management — Add` },
                timestamp: Date.now(),
            });

            const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
            await transactionsChannel.send({ embeds: [announcement] });

            return await interaction.editReply(`This operation is complete. ${guildMember} is now an assistant general manager for ${franchise.name}!`);
        }
    }
}

async function updateTransactionsPerms(/** @type ChatInputCommandInteraction */ interaction, guildMember, franchise, /** @type {`ADD`|`REMOVE`} type */ type) {
    const channelID = process.env.ENVIRONMENT ? devTransactionsChannel : franchise.transactionsChannelID;
    const channel = await interaction.guild.channels.fetch(channelID);

    if (type == `REMOVE`) return await channel.permissionOverwrites.delete(guildMember.user.id);
    else return await channel.permissionOverwrites.create(guildMember.user.id, { ViewChannel: true, SendMessages: true });
}

module.exports = {
    updateFranchiseManagement: updateFranchiseManagement
}