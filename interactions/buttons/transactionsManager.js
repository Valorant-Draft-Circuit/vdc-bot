const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require("discord.js");

const { CHANNELS, ROLES, TransactionsSubTypes, TransactionsCutOptions, TransactionsIROptions, TransactionsSignOptions, TransactionsDraftSignOptions, TransactionsRenewOptions, ContractStatus, TransactionsUpdateTierOptions } = require(`../../utils/enums`);

const { Franchise, Team, Transaction, Player } = require(`../../prisma`);

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

let transactionsAnnouncementChannel;

module.exports = {

    id: `transactionsManager`,

    async execute(interaction, args) {
        transactionsAnnouncementChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);

        switch (Number(args)) {
            //  CONFIRM BUTTONS  ###################################
            case TransactionsSignOptions.CONFIRM:
                return await confirmSign(interaction);
            case TransactionsDraftSignOptions.CONFIRM:
                return await confirmDraftSign(interaction);
            case TransactionsCutOptions.CONFIRM:
                return await confirmCut(interaction);
            case TransactionsRenewOptions.CONFIRM:
                return await confirmRenew(interaction);
            case TransactionsUpdateTierOptions.CONFIRM:
                return await confirmUpdateTier(interaction);
            case TransactionsSubTypes.CONFIRM_SUB:
                return await confirmSub(interaction);
            case TransactionsSubTypes.CONFIRM_UNSUB:
                return await confirmUnsub(interaction);
            case TransactionsIROptions.CONFIRM_SET:
                return await confirmSetIR(interaction);
            case TransactionsIROptions.CONFIRM_REMOVE:
                return await confirmRemoveIR(interaction);

            //  CANCEL BUTTONS  ####################################
            case TransactionsSignOptions.CANCEL:
            case TransactionsDraftSignOptions.CANCEL:
            case TransactionsCutOptions.CANCEL:
            case TransactionsRenewOptions.CANCEL:
            case TransactionsUpdateTierOptions.CANCEL:
            case TransactionsSubTypes.CANCEL:
            case TransactionsIROptions.CANCEL:
                return await cancel(interaction);

            default:
                return interaction.reply({ content: `There was an error. ERR: BTN_TSC_MGR` });
        }


    }
};

async function confirmSign(interaction) {
    await interaction.deferReply({ ephemeral: true }); // defer as early as possible

    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
    const playerID = data[2];

    const playerData = await Player.getBy({ discordID: playerID });
    const playerIGN = await Player.getIGNby({ discordID: playerID });
    const teamData = await Team.getBy({ name: data[3] });
    const franchiseData = await Franchise.getBy({ name: data[4] });

    const playerTag = playerIGN.split(`#`)[0];
    const guildMember = await interaction.guild.members.fetch(playerID);
    const accolades = guildMember.nickname?.match(emoteregex);

    // add the franchise role, remove FA/RFA role
    if (!guildMember._roles.includes(franchiseData.roleID)) await guildMember.roles.add(franchiseData.roleID);
    if (guildMember._roles.includes(ROLES.LEAGUE.FREE_AGENT)) await guildMember.roles.remove(ROLES.LEAGUE.FREE_AGENT);
    if (guildMember._roles.includes(ROLES.LEAGUE.RESTRICTED_FREE_AGENT)) await guildMember.roles.remove(ROLES.LEAGUE.RESTRICTED_FREE_AGENT);

    // update nickname
    guildMember.setNickname(`${franchiseData.slug} | ${playerTag} ${accolades ? accolades.join(``) : ``}`);

    // cut the player & ensure that the player's team property is now null
    const player = await Transaction.sign({ playerID: playerData.id, teamID: teamData.id });
    if (player.team !== teamData.id) return interaction.editReply({ content: `There was an error while attempting to renew the player's contract. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);
    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);
    await interaction.message.edit({ embeds: [embedEdits], components: [] });

    // create the base embed
    const announcement = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `${guildMember} (${playerTag}) was signed to ${franchiseData.name}`,
        thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}` },
        color: 0xE92929,
        fields: [
            {
                name: `Franchise`,
                value: `<${franchiseData.emoteID}> ${franchiseData.name}`,
                inline: true
            },
            {
                name: `Team`,
                value: teamData.name,
                inline: true
            },
            /** @TODO Once GM discord IDs are in Franchsie Table, show this block */
            // {
            //     name: `General Manager`,
            //     value: `"\${franchiseData.gm}"`,
            //     inline: true
            // }
        ],
        footer: { text: `Transactions — Sign` },
        timestamp: Date.now(),
    });

    await interaction.deleteReply();
    return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

async function confirmDraftSign(interaction) {
    await interaction.deferReply({ ephemeral: true }); // defer as early as possible

    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);

    // process data into usable format(s)
    const playerID = data[3];
    const round = data[1].split(`/`)[0].trim();
    const pick = data[1].split(`/`)[1].trim();

    // db queries
    const playerData = await Player.getBy({ discordID: playerID });
    const playerIGN = await Player.getIGNby({ discordID: playerID });
    const teamData = await Team.getBy({ name: data[4] });
    const franchiseData = await Franchise.getBy({ name: data[5] });

    // also get the GuildMember object
    const playerTag = playerIGN.split(`#`)[0];
    const guildMember = await interaction.guild.members.fetch(playerID);
    const accolades = guildMember.nickname?.match(emoteregex);

    // add the franchise role, remove FA/RFA role
    if (!guildMember._roles.includes(franchiseData.roleID)) await guildMember.roles.add(franchiseData.roleID);
    if (guildMember._roles.includes(ROLES.LEAGUE.DRAFT_ELIGIBLE)) await guildMember.roles.remove(ROLES.LEAGUE.DRAFT_ELIGIBLE);
    if (guildMember._roles.includes(ROLES.LEAGUE.FREE_AGENT)) await guildMember.roles.remove(ROLES.LEAGUE.FREE_AGENT);
    if (guildMember._roles.includes(ROLES.LEAGUE.RESTRICTED_FREE_AGENT)) await guildMember.roles.remove(ROLES.LEAGUE.RESTRICTED_FREE_AGENT);

    switch (teamData.tier) {
        case `Prospect`:
            await guildMember.roles.add(ROLES.TIER.PROSPECT);
            console.log(`here`)
            break;
        case `Apprentice`:
            await guildMember.roles.add(ROLES.TIER.APPRENTICE);
            break;
        case `Expert`:
            await guildMember.roles.add(ROLES.TIER.EXPERT);
            break;
        case `Mythic`:
            await guildMember.roles.add(ROLES.TIER.MYTHIC);
            break;
    }

    // update nickname
    guildMember.setNickname(`${franchiseData.slug} | ${playerTag} ${accolades ? accolades.join(``) : ``}`);

    // sign the player & ensure that the player's team property is now null
    const player = await Transaction.sign({ playerID: playerData.id, teamID: teamData.id });
    if (player.team !== teamData.id) return interaction.editReply({ content: `There was an error while attempting to sign the player's contract. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);
    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);
    await interaction.message.edit({ embeds: [embedEdits], components: [] });

    // create the base embed
    const announcement = new EmbedBuilder({
        author: { name: `Round: ${round} | Pick: ${pick} | ${teamData.tier}` },
        description: `${teamData.name} select ${guildMember} (${playerTag})!`,
        thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}` },
        color: 0xE92929,
        fields: [
            {
                name: `Franchise`,
                value: `<${franchiseData.emoteID}> ${franchiseData.name}`,
                inline: true
            },
            {
                name: `Team`,
                value: teamData.name,
                inline: true
            },
            /** @TODO Once GM discord IDs are in Franchsie Table, show this block */
            // {
            //     name: `General Manager`,
            //     value: `"\${franchiseData.gm}"`,
            //     inline: true
            // }
        ],
        footer: { text: `Transactions — Draft Sign` },
        timestamp: Date.now(),
    });

    await interaction.deleteReply();
    return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

async function confirmCut(interaction) {
    await interaction.deferReply({ ephemeral: true }); // defer as early as possible

    const playerID = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`)[2];

    const playerData = await Player.getInfoBy({ discordID: playerID });
    const playerIGN = await Player.getIGNby({ discordID: playerID });
    const guildMember = await interaction.guild.members.fetch(playerID);

    const playerTag = playerIGN.split(`#`)[0];
    const accolades = guildMember.nickname?.match(emoteregex);

    // remove the franchise role and update their nickname
    if (guildMember._roles.includes(playerData.franchise.roleID)) await guildMember.roles.remove(playerData.franchise.roleID);
    await guildMember.roles.add(ROLES.LEAGUE.FREE_AGENT);
    guildMember.setNickname(`FA | ${playerTag} ${accolades ? accolades.join(``) : ``}`);

    // cut the player & ensure that the player's team property is now null
    const player = await Transaction.cut(playerID);
    if (player.team !== null) return interaction.editReply({ content: `There was an error while attempting to cut the player. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);
    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);
    await interaction.message.edit({ embeds: [embedEdits], components: [] });

    // create the base embed
    const announcement = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `${guildMember} (${playerTag}) was cut from ${playerData.franchise.name}`,
        thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${playerData.franchise.logoFileName}` },
        color: 0xE92929,
        fields: [
            {
                name: `Franchise`,
                value: `<${playerData.franchise.emoteID}> ${playerData.franchise.name}`,
                inline: true
            },
            {
                name: `Team`,
                value: playerData.team.name,
                inline: true
            },
            /** @TODO Once GM discord IDs are in Franchsie Table, show this block */
            // {
            //     name: `General Manager`,
            //     value: `"\${playerData.franchise.gm}"`,
            //     inline: true
            // }
        ],
        footer: { text: `Transactions — CUT` },
        timestamp: Date.now(),
    });

    await interaction.deleteReply();
    return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

async function confirmRenew(interaction) {
    await interaction.deferReply({ ephemeral: true }); // defer as early as possible

    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
    const playerID = data[2];

    const playerData = await Player.getBy({ discordID: playerID });
    const playerIGN = await Player.getIGNby({ discordID: playerID });
    const teamData = await Team.getBy({ name: data[3] });
    const franchiseData = await Franchise.getBy({ name: data[4] });

    const playerTag = playerIGN.split(`#`)[0];
    const guildMember = await interaction.guild.members.fetch(playerID);


    // cut the player & ensure that the player's team property is now null
    const player = await Transaction.renew({ playerID: playerData.id });
    if (player.team !== teamData.id || player.contractStatus !== ContractStatus.RENEWED) return interaction.editReply({ content: `There was an error while attempting to renew the player's contract. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);
    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);
    await interaction.message.edit({ embeds: [embedEdits], components: [] });

    // create the base embed
    const announcement = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `${guildMember} (${playerTag})'s contract was renewed by ${franchiseData.name}`,
        thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}` },
        color: 0xE92929,
        fields: [
            {
                name: `Franchise`,
                value: `<${franchiseData.emoteID}> ${franchiseData.name}`,
                inline: true
            },
            {
                name: `Team`,
                value: teamData.name,
                inline: true
            },
            /** @TODO Once GM discord IDs are in Franchsie Table, show this block */
            // {
            //     name: `General Manager`,
            //     value: `"\${franchiseData.gm}"`,
            //     inline: true
            // }
        ],
        footer: { text: `Transactions — Renew` },
        timestamp: Date.now(),
    });

    await interaction.deleteReply();
    return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

async function confirmUpdateTier(interaction) {
    await interaction.deferReply({ ephemeral: true }); // defer as early as possible

    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
    const playerID = data[2];

    const player = await Player.getBy({ discordID: playerID });
    const playerIGN = await Player.getIGNby({ discordID: playerID });
    const team = await Team.getBy({ playerID: playerID });
    const franchise = await Franchise.getBy({ teamID: team.id });
    const franchiseTeams = await Franchise.getTeams({ id: franchise.id });

    const newTeam = franchiseTeams.filter(t => t.tier === data[4])[0];
    const playerTag = playerIGN.split(`#`)[0];
    const guildMember = await interaction.guild.members.fetch(playerID);


    // update the player the player & ensure that the player's team property is now null
    const updatedPlayer = await Transaction.updateTier({ playerID: player.id, teamID: newTeam.id });
    if (updatedPlayer.team !== newTeam.id) return await interaction.editReply({ content: `There was an error while attempting to update the player's tier. The database was not updated.` });

    // create & send the "successfully completed" embed
    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);
    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);
    await interaction.message.edit({ embeds: [embedEdits], components: [] });

    // create the base embed
    const announcement = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `${guildMember} (${playerTag})'s tier was updated!\n${data[3]} => ${data[4]}`,
        thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchise.logoFileName}` },
        color: 0xE92929,
        fields: [
            {
                name: `Franchise`,
                value: `<${franchise.emoteID}> ${franchise.name}`,
                inline: true
            },
            {
                name: `Team`,
                value: newTeam.name,
                inline: true
            },
            /** @TODO Once GM discord IDs are in Franchsie Table, show this block */
            // {
            //     name: `General Manager`,
            //     value: `"\${franchise.gm}"`,
            //     inline: true
            // }
        ],
        footer: { text: `Transactions — Renew` },
        timestamp: Date.now(),
    });

    await interaction.deleteReply();
    return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

async function confirmSub(interaction) {
    await interaction.deferReply({ ephemeral: true }); // defer as early as possible

    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
    const playerID = data[2];

    const playerData = await Player.getBy({ discordID: playerID });
    const playerIGN = await Player.getIGNby({ discordID: playerID });
    const teamData = await Team.getBy({ name: data[3] });
    const franchiseData = await Franchise.getBy({ name: data[4] });


    const playerTag = playerIGN.split(`#`)[0];
    const guildMember = await interaction.guild.members.fetch(playerID);

    // cut the player & ensure that the player's team property is now null
    const player = await Transaction.sub({ playerID: playerID, teamID: teamData.id });
    if (player.team !== teamData.id) return interaction.editReply({ content: `There was an error while attempting to sub the player. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);
    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);
    await interaction.message.edit({ embeds: [embedEdits], components: [] });

    // create the base embed
    const announcement = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `${guildMember} (${playerTag}) has signed a temporary contract with ${franchiseData.name}!`,
        thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}` },
        color: 0xE92929,
        fields: [
            {
                name: `Franchise`,
                value: `<${franchiseData.emoteID}> ${franchiseData.name}`,
                inline: true
            },
            {
                name: `Team`,
                value: teamData.name,
                inline: true
            },
            /** @TODO Once GM discord IDs are in Franchsie Table, show this block */
            // {
            //     name: `General Manager`,
            //     value: `"\${franchiseData.gm}"`,
            //     inline: true
            // }
        ],
        footer: { text: `Transactions — Sub` },
        timestamp: Date.now(),
    });


    await transactionsAnnouncementChannel.send({ embeds: [announcement] });


    const activeSubTimeMS = 8 /* Hours a sub is active for the team */ * 60 * 60 * 1000; // conversion to milliseconds
    setTimeout(async () => {
        // unsub the player & ensure that the player's team property is now null
        const player = await Transaction.unsub({ playerID: playerData.id });
        if (player.team !== null) return await interaction.channel.send({ content: `There was an error while attempting to unsub ${guildMember} (${playerTag}). The database was not updated.` });

        // create the base embed
        const announcement = new EmbedBuilder({
            author: { name: `VDC Transactions Manager` },
            description: `${guildMember} (${playerTag})'s temporary contract with ${teamData.name} has ended!`,
            thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}` },
            color: 0xE92929,
            footer: { text: `Transactions — Unsub` },
            timestamp: Date.now(),
        });

        return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
    }, activeSubTimeMS)
}

async function confirmUnsub(interaction) {
    await interaction.deferReply({ ephemeral: true }); // defer as early as possible

    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
    const playerID = data[2];

    const playerData = await Player.getBy({ discordID: playerID });
    const playerIGN = await Player.getIGNby({ discordID: playerID });
    const teamData = await Team.getBy({ name: data[3] });
    const franchiseData = await Franchise.getBy({ name: data[4] });


    const playerTag = playerIGN.split(`#`)[0];
    const guildMember = await interaction.guild.members.fetch(playerID);

    // cut the player & ensure that the player's team property is now null
    const player = await Transaction.unsub({ playerID: playerData.id });
    if (player.team !== null) return interaction.editReply({ content: `There was an error while attempting to unsub the player. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);
    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);
    await interaction.message.edit({ embeds: [embedEdits], components: [] });

    // create the base embed
    const announcement = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `${guildMember} (${playerTag})'s temporary contract with ${teamData.name} has ended!`,
        thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}` },
        color: 0xE92929,
        footer: { text: `Transactions — Unsub` },
        timestamp: Date.now(),
    });

    await interaction.deleteReply();
    return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

async function confirmSetIR(interaction) {
    await interaction.deferReply({ ephemeral: true }); // defer as early as possible

    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
    const playerID = data[2];

    const playerData = await Player.getBy({ discordID: playerID });
    const playerIGN = await Player.getIGNby({ discordID: playerID });
    const franchiseData = await Franchise.getBy({ name: data[4] });

    const playerTag = playerIGN.split(`#`)[0];
    const guildMember = await interaction.guild.members.fetch(playerID);

    // cut the player & ensure that the player's team property is now null
    const player = await Transaction.inactiveReserve({ playerID: playerData.id });
    if (player.contractStatus !== ContractStatus.INACTIVE_RESERVE) return interaction.editReply({ content: `There was an error while attempting to place the player on Inactive Reserve. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);
    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);
    await interaction.message.edit({ embeds: [embedEdits], components: [] });

    // create the base embed
    const announcement = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `${guildMember} (${playerTag}) has been placed on Inactive Reserve`,
        thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}` },
        color: 0xE92929,
        footer: { text: `Transactions — Inactive Reserve` },
        timestamp: Date.now(),
    });

    await interaction.deleteReply();
    return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

async function confirmSetIR(interaction) {
    await interaction.deferReply({ ephemeral: true }); // defer as early as possible

    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
    const playerID = data[2];

    const playerData = await Player.getBy({ discordID: playerID });
    const playerIGN = await Player.getIGNby({ discordID: playerID });
    const franchiseData = await Franchise.getBy({ name: data[4] });

    const playerTag = playerIGN.split(`#`)[0];
    const guildMember = await interaction.guild.members.fetch(playerID);

    // cut the player & ensure that the player's team property is now null
    const player = await Transaction.toggleInactiveReserve({ playerID: playerData.id, toggle: `SET` });
    if (player.contractStatus !== ContractStatus.INACTIVE_RESERVE) return interaction.editReply({ content: `There was an error while attempting to place the player on Inactive Reserve. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);
    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);
    await interaction.message.edit({ embeds: [embedEdits], components: [] });

    // create the base embed
    const announcement = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `${guildMember} (${playerTag}) has been placed on Inactive Reserve`,
        thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}` },
        color: 0xE92929,
        footer: { text: `Transactions — Inactive Reserve` },
        timestamp: Date.now(),
    });

    await interaction.deleteReply();
    return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

async function confirmRemoveIR(interaction) {
    await interaction.deferReply({ ephemeral: true }); // defer as early as possible

    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
    const playerID = data[2];

    const playerData = await Player.getBy({ discordID: playerID });
    const playerIGN = await Player.getIGNby({ discordID: playerID });
    const franchiseData = await Franchise.getBy({ name: data[4] });

    const playerTag = playerIGN.split(`#`)[0];
    const guildMember = await interaction.guild.members.fetch(playerID);

    // cut the player & ensure that the player's team property is now null
    const player = await Transaction.toggleInactiveReserve({ playerID: playerData.id, toggle: `REMOVE` });
    if (player.contractStatus === ContractStatus.INACTIVE_RESERVE) return interaction.editReply({ content: `There was an error while attempting to remove the player from Inactive Reserve. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);
    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);
    await interaction.message.edit({ embeds: [embedEdits], components: [] });

    // create the base embed
    const announcement = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `${guildMember} (${playerTag}) is no longer on Inactive Reserve`,
        thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}` },
        color: 0xE92929,
        footer: { text: `Transactions — Inactive Reserve` },
        timestamp: Date.now(),
    });

    await interaction.deleteReply();
    return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

async function cancel(interaction) {
    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);

    embedEdits.setDescription(`This operation was cancelled.`);
    embedEdits.setFields([]);

    return await interaction.message.edit({ embeds: [embedEdits], components: [] });
}