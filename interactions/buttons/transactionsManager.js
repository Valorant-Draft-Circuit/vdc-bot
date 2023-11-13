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
    interaction.deferUpdate(); // defer as early as possible

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
    if (player.team !== teamData.id) return interaction.reply({ content: `There was an error while attempting to renew the player's contract. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);

    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);

    interaction.message.edit({ embeds: [embedEdits], components: [] });

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

    transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

async function confirmDraftSign(interaction) {
    interaction.deferUpdate(); // defer as early as possible

    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
    const playerID = data[2];

    const playerData = await Player.getBy({ discordID: playerID });
    const playerRiotID = await Player.getIGNby({ discordID: playerID });
    const teamData = await Team.getBy({ name: data[3] });
    const franchiseData = await Franchise.getBy({ name: data[4] });

    const playerTag = playerRiotID.split(`#`)[0];
    const guildMember = await interaction.guild.members.fetch(playerID);

    // add the franchise role, remove FA/RFA role
    // if (!guildMember._roles.includes(franchiseData.roleID)) await guildMember.roles.add(franchiseData.roleID);
    if (guildMember._roles.includes(ROLES.LEAGUE.DRAFT_ELIGIBLE)) await guildMember.roles.remove(ROLES.LEAGUE.DRAFT_ELIGIBLE);
    
    // update nickname
    guildMember.setNickname(`${franchiseData.slug} | ${playerTag}`);


    // sign the player & ensure that the player's team property is now null
    const player = await Transaction.sign({ playerID: playerData.id, teamID: teamData.id });
    if (player.team !== teamData.id) return interaction.reply({ content: `There was an error while attempting to sign the player's contract. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);

    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);

    interaction.message.edit({ embeds: [embedEdits], components: [] });

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
        footer: { text: `Transactions — Draft Sign` },
        timestamp: Date.now(),
    });

    transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

async function confirmCut(interaction) {
    interaction.deferUpdate(); // defer as early as possible

    const playerID = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`)[2];

    const playerData = await Player.getInfoBy({ discordID: playerID });
    const guildMember = await interaction.guild.members.fetch(playerID);

    // remove the franchise role and update their nickname
    if (guildMember._roles.includes(playerData.franchise.roleID)) await guildMember.roles.remove(playerData.franchise.roleID);
    await guildMember.roles.add(ROLES.LEAGUE.FREE_AGENT);
    guildMember.setNickname(`FA | ${guildMember.nickname.split(` `)[2]}`);

    // cut the player & ensure that the player's team property is now null
    const player = await Transaction.cut(playerID);
    if (player.team !== null) return interaction.reply({ content: `There was an error while attempting to cut the player. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);

    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);

    interaction.message.edit({ embeds: [embedEdits], components: [] });
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

    transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

async function confirmRenew(interaction) {
    interaction.deferUpdate(); // defer as early as possible

    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
    const playerID = data[2];

    const playerData = await Player.getBy({ discordID: playerID });
    const teamData = await Team.getBy({ name: data[3] });
    const franchiseData = await Franchise.getBy({ name: data[4] });

    const guildMember = await interaction.guild.members.fetch(playerID);


    // cut the player & ensure that the player's team property is now null
    const player = await Transaction.renew({ playerID: playerData.id });
    if (player.team !== teamData.id || player.contractStatus !== ContractStatus.RENEWED) return interaction.reply({ content: `There was an error while attempting to renew the player's contract. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);

    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);

    interaction.message.edit({ embeds: [embedEdits], components: [] });

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

    transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

async function cancel(interaction) {
    interaction.deferUpdate(); // defer as early as possible

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);

    embedEdits.setDescription(`This operation was cancelled.`);
    embedEdits.setFields([]);

    interaction.message.edit({ embeds: [embedEdits], components: [] });
}