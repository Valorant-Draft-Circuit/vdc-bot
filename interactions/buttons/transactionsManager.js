const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require("discord.js");


const { CHANNELS, ROLES, TransactionsSubTypes, TransactionsCutOptions, TransactionsIROptions, TransactionsSignOptions, TransactionsDraftSignOptions, TransactionsRenewOptions, ContractStatus, TransactionsUpdateTierOptions } = require(`../../utils/enums`);


const { Franchise, Team, Transaction, Player } = require(`../../prisma`);

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

            //  CANCEL BUTTONS  ####################################
            case TransactionsSignOptions.CANCEL:
            case TransactionsDraftSignOptions.CANCEL:
            case TransactionsCutOptions.CANCEL:
            case TransactionsRenewOptions.CANCEL:
            case TransactionsUpdateTierOptions.CANCEL:
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
    const teamData = await Team.getBy({ name: data[3] });
    const franchiseData = await Franchise.getBy({ name: data[4] });

    const guildMember = await interaction.guild.members.fetch(playerID);

    // add the franchise role, remove FA/RFA role
    if (!guildMember._roles.includes(franchiseData.roleID)) await guildMember.roles.add(franchiseData.roleID);
    if (guildMember._roles.includes(ROLES.LEAGUE.FREE_AGENT)) await guildMember.roles.remove(ROLES.LEAGUE.FREE_AGENT);
    if (guildMember._roles.includes(ROLES.LEAGUE.RESTRICTED_FREE_AGENT)) await guildMember.roles.remove(ROLES.LEAGUE.RESTRICTED_FREE_AGENT);

    // update nickname
    guildMember.setNickname(`${franchiseData.slug} | ${guildMember.nickname.split(` `)[2]}`);

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
        description: `${guildMember} (${guildMember.nickname.split(` `)[2]}) was signed to ${franchiseData.name}`,
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
    const playerRiotID = await Player.getIGNby({discordID: playerID})
    const teamData = await Team.getBy({ name: data[4] });
    const franchiseData = await Franchise.getBy({ name: data[5] });

    // also get the GuildMember object
    const guildMember = await interaction.guild.members.fetch(playerID);

    // add the franchise role, remove FA/RFA role
    if (!guildMember._roles.includes(franchiseData.roleID)) await guildMember.roles.add(franchiseData.roleID);
    if (guildMember._roles.includes(ROLES.LEAGUE.DRAFT_ELIGIBLE)) await guildMember.roles.remove(ROLES.LEAGUE.DRAFT_ELIGIBLE);

    // update nickname
    const playerTag = playerRiotID.split(`#`)[0];
    guildMember.setNickname(`${franchiseData.slug} | ${playerTag}`);

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
    const guildMember = await interaction.guild.members.fetch(playerID);

    // remove the franchise role and update their nickname
    if (guildMember._roles.includes(playerData.franchise.roleID)) await guildMember.roles.remove(playerData.franchise.roleID);
    await guildMember.roles.add(ROLES.LEAGUE.FREE_AGENT);
    guildMember.setNickname(`FA | ${guildMember.nickname.split(` `)[2]}`);

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
        description: `${guildMember} (${guildMember.nickname.split(` `)[2]}) was cut from ${playerData.franchise.name}`,
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
    const teamData = await Team.getBy({ name: data[3] });
    const franchiseData = await Franchise.getBy({ name: data[4] });

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
        description: `${guildMember} (${guildMember.nickname.split(` `)[2]})'s contract was renewed by ${franchiseData.name}`,
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
    const playerRiotID = await Player.getIGNby({ discordID: playerID });
    const team = await Team.getBy({ playerID: playerID });
    const franchise = await Franchise.getBy({ teamID: team.id });
    const franchiseTeams = await Franchise.getTeams({ id: franchise.id });

    const newTeam = franchiseTeams.filter(t => t.tier === data[4])[0];
    const playerTag = playerRiotID.split(`#`)[0];
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

async function cancel(interaction) {
    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);

    embedEdits.setDescription(`This operation was cancelled.`);
    embedEdits.setFields([]);

    return await interaction.message.edit({ embeds: [embedEdits], components: [] });
}