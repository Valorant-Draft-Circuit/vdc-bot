const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require("discord.js");

const { CHANNELS, FranchiseEmote, TransactionsSubTypes, TransactionsCutOptions, TransactionsIROptions, TransactionsSignOptions, TransactionsDraftSignOptions, TransactionsRenewOptions } = require(`../../utils/enums`);


const { Franchise, Team, Transaction, Player } = require(`../../prisma`);

let transactionsAnnouncementChannel;

module.exports = {

    id: `transactionsManager`,

    async execute(interaction, args) {
        transactionsAnnouncementChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);

        switch (Number(args)) {
            //  CONFIRM BUTTONS  ###################################
            case TransactionsSignOptions.CONFIRM:
                await confirmSign(interaction);
                break;
            case TransactionsDraftSignOptions.CONFIRM:
                await confirmDraftSign(interaction);
                break;
            case TransactionsCutOptions.CONFIRM:
                await confirmCut(interaction);
                break;
            case TransactionsRenewOptions.CONFIRM:
                await confirmRenew(interaction);
                break;

            //  CANCEL BUTTONS  ####################################
            case TransactionsSignOptions.CANCEL:
            case TransactionsDraftSignOptions.CANCEL:
            case TransactionsCutOptions.CANCEL:
            case TransactionsRenewOptions.CANCEL:

                cancel(interaction);
                break

            default:
                interaction.reply({ content: `There was an error. ERR: BTN_TSC_MGR` });
                break;
        }


    }
};

async function confirmSign(interaction) {

    interaction.reply({ content: `confirm sign` });
}

async function confirmDraftSign(interaction) {

    interaction.reply({ content: `confirm sign` });
}

async function confirmCut(interaction) {
    interaction.deferUpdate();

    const playerID = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`)[2];

    const playerData = await Player.getInfoBy({ discordID: playerID });
    const guildMember = await interaction.guild.members.fetch(playerID);

    // remove the franchise role and update their nickname
    if (guildMember._roles.includes(playerData.franchise.roleID)) await guildMember.roles.remove(playerData.franchise.roleID);
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

    transactionsAnnouncementChannel.send({ embeds: [announcement] })
}


async function confirmRenew(interaction) {

    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
    const playerID = data[2];

    const playerData = await Player.getBy({ discordID: playerID });
    const teamData = await Team.getBy({ name: data[3] });
    const franchiseData = await Franchise.getBy({ name: data[4] });

    const guildMember = await interaction.guild.members.fetch(playerID);


    console.log(data)
    console.log(playerData)
    console.log(teamData)
    console.log(franchiseData)


    // remove the franchise role and update their nickname
    // if (!guildMember._roles.includes(franchiseData.roleID)) await guildMember.roles.add(franchiseData.roleID);
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

    transactionsAnnouncementChannel.send({ embeds: [announcement] })

    interaction.deferUpdate();
}

async function cancel(interaction) {
    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);

    embedEdits.setDescription(`This operation was cancelled.`);
    embedEdits.setFields([]);

    interaction.message.edit({ embeds: [embedEdits], components: [] });

    interaction.deferUpdate();
}