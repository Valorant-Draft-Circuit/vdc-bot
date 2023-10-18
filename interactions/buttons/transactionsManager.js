const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require("discord.js");

const { Channel, FranchiseEmote, TransactionsSubTypes, ContenderTeams, AdvancedTeams, MasterTeams, EliteTeams, Tier, TransactionsCutOptions, TransactionsSignOptions, TransactionsDraftSignOptions } = require(`../../utils/enums`);


const { Franchise, Team, Transaction, Player } = require(`../../prisma`);

let transactionsAnnouncementChannel;

module.exports = {

    id: `transactionsManager`,

    async execute(interaction, args) {
        transactionsAnnouncementChannel = await interaction.guild.channels.fetch(Channel.TRANSACTIONS);

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

            //  CANCEL BUTTONS  ####################################
            case TransactionsSignOptions.CANCEL:
            case TransactionsCutOptions.CANCEL:
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

    transactionsAnnouncementChannel.send({content: ``, embeds: [announcement]})
}

async function cancel(interaction) {
    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);

    embedEdits.setDescription(`This operation was cancelled.`);
    embedEdits.setFields([]);

    interaction.message.edit({ embeds: [embedEdits], components: [] });

    interaction.deferUpdate();
}