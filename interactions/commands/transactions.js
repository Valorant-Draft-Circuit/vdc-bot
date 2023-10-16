const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder } = require("discord.js");

const { ButtonStyle } = require(`discord.js`)

const { Franchise, Games, Player, Team } = require("../../prisma");
const { TransactionsSubTypes, TransactionsCutOptions, TransactionsSignOptions, Channel } = require(`../../utils/enums/`);
const { FranchiseEmote } = require(`../../utils/enums/franchiseEmotes`);
const franchises = require(`../../cache/franchises.json`);

module.exports = {

    name: `transactions`,

    execute(interaction) {

        const { _subcommand, _hoistedOptions } = interaction.options;

        const subcommmand = interaction.options._subcommand;
        let player, franchise;

        switch (_subcommand) {
            case `sub`:
                sub(interaction)
                break;
            case `cut`:
                cut(interaction, _hoistedOptions[0]);
                break;
            case `sign`:
                sign(interaction, _hoistedOptions[0], _hoistedOptions[1].value);
                break;
            case `swap`:
                swap(interaction, _hoistedOptions[0], _hoistedOptions[1]);
                break;
            case `ir`:
                // player = _hoistedOptions[0];
                ir(interaction, _hoistedOptions[0]);
                break;
            case `trade`:
                // player = _hoistedOptions[0];
                trade(interaction);
                break;
            default:
                interaction.reply({ content: `That's not a valid subcommand!` });
                break;
        }
    }
};

function sub(interaction) {

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `Welcome to the Transactions Substitute UI. Please use the select menus below to temporarily sign a substitute to your franchise & team.`,
        thumbnail: { url: `https://cdn.discordapp.com/banners/963274331251671071/57044c6a68be1065a21963ee7e697f80.webp?size=480` },
        color: 0xE92929,
        fields: [
            {
                name: `\u200B`,
                value: `**Franchise**\nPlease select a franchise....`,
                inline: true
            }
        ],
        footer: { text: `Transactions — Sub` }
    });

    // create the string select menu for a user to select a franchise & then add the franchises
    const selectMenu = new StringSelectMenuBuilder({
        customId: `transactions_${TransactionsSubTypes.FRANCHISE}`,
        placeholder: 'Select a franchise...',
        maxValues: 1,
    });


    franchises.forEach((franchise) => {
        selectMenu.addOptions({
            label: franchise.name,
            value: franchise.slug,
            description: `${franchise.slug} — ${franchise.name}`,
            emoji: FranchiseEmote[franchise.slug]
        });
    });

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder();
    subrow.addComponents(selectMenu);

    interaction.reply({ embeds: [embed], components: [subrow] });
}

async function cut(interaction, player) {
    const playerData = await Player.getBy({discordID: player.value});
    
    // checks
    if (playerData == undefined) return interaction.reply({ content: `This player doesn't exist!`, ephemeral: false });
    if (playerData.team == null) return interaction.reply({ content: `This player is not on a team!`, ephemeral: false });

    const franchise = await Franchise.getBy({teamID: playerData.team});
    const team = await Team.getBy({id: playerData.team});

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `Are you sure you perform the following action?`,
        color: 0xE92929,
        fields: [
            {
                name: `\u200B`,
                value: `**Transaction**\n\`  Player Tag: \`\n\`   Player ID: \`\n\`        Team: \`\n\`   Franchise: \``,
                inline: true
             },
             {
                name: `\u200B`,
                value: `CUT\n${player.user}\n\`${player.value}\`\n${team.name}\n${franchise.name}`,
                inline: true
             }
        ],
        footer: { text: `Transactions — Cut` }
    });

    const cancel = new ButtonBuilder({
        customId: `transactions_${TransactionsCutOptions.CANCEL}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
        // emoji: `❌`,
    })

    const confirm = new ButtonBuilder({
        customId: `transactions_${TransactionsCutOptions.CONFIRM}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
        // emoji: `✔`,
    })

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder();
    // console.log(subrow)
    subrow.addComponents(cancel, confirm);

    // interaction.message.edit({ embeds: [embedEdits] });
    // console.log(subrow)
    interaction.reply({ embeds: [embed], components: [subrow] });
}

function sign(interaction, player, franchise) {
    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `Are you sure you want to sign ${player.user} to ${franchise}`,
        color: 0xE92929,
        thumbnail: { url: `https://cdn.discordapp.com/banners/963274331251671071/57044c6a68be1065a21963ee7e697f80.webp?size=480` },
        footer: { text: `Transactions — Sign` }
    });

    const cancel = new ButtonBuilder({
        customId: `transactions_${TransactionsSignOptions.CANCEL}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
        // emoji: `❌`,
    })

    const confirm = new ButtonBuilder({
        customId: `transactions_${TransactionsSignOptions.CONFIRM}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
        // emoji: `✔`,
    })

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder();
    // console.log(subrow)
    subrow.addComponents(cancel, confirm);

    // interaction.message.edit({ embeds: [embedEdits] });
    // console.log(subrow)
    interaction.reply({ embeds: [embed], components: [subrow] });
}

function swap(interaction, cutPlayer, signPlayer) {
    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `Are you sure you want to cut ${cutPlayer.user} & sign ${signPlayer.user} in their place to <FRANCHISE>`,
        color: 0xE92929,
        thumbnail: { url: `https://cdn.discordapp.com/banners/963274331251671071/57044c6a68be1065a21963ee7e697f80.webp?size=480` },
        footer: { text: `Transactions — Swap` }
    });

    const cancel = new ButtonBuilder({
        customId: `transactions_${TransactionsCutOptions.CONFIRM}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
        // emoji: `❌`,
    })

    const confirm = new ButtonBuilder({
        customId: `transactions_${TransactionsCutOptions.CANCEL}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
        // emoji: `✔`,
    })

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder();
    // console.log(subrow)
    subrow.addComponents(cancel, confirm);

    // interaction.message.edit({ embeds: [embedEdits] });
    // console.log(subrow)
    interaction.reply({ embeds: [embed], components: [subrow] });
}

function ir(interaction, player) {
    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `Are you sure you want to place ${player.user} on Inactive Reserve?`,
        color: 0xE92929,
        footer: { text: `Transactions — Inactive Reserve` }
    });

    const cancel = new ButtonBuilder({
        customId: `transactions_${TransactionsCutOptions.CONFIRM}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
        // emoji: `❌`,
    })

    const confirm = new ButtonBuilder({
        customId: `transactions_${TransactionsCutOptions.CANCEL}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
        // emoji: `✔`,
    })

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder();
    // console.log(subrow)
    subrow.addComponents(cancel, confirm);

    // interaction.message.edit({ embeds: [embedEdits] });
    // console.log(subrow)
    interaction.reply({ embeds: [embed], components: [subrow] });
}

function trade(interaction) {

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `Welcome to the Transactions Trade UI.`,
        thumbnail: { url: `https://cdn.discordapp.com/banners/963274331251671071/57044c6a68be1065a21963ee7e697f80.webp?size=480` },
        color: 0xE92929,
        footer: { text: `Transactions — Trade` }
    });

    // create the string select menu for a user to select a franchise & then add the franchises
    const selectMenu = new StringSelectMenuBuilder({
        customId: `transactions_${TransactionsSubTypes.FRANCHISE}`,
        placeholder: 'Select a franchise...',
        maxValues: 1,
    });


    // franchises.forEach((franchise) => {
    //     selectMenu.addOptions({
    //         label: franchise.name,
    //         value: franchise.slug,
    //         description: `${franchise.slug} — ${franchise.name}`,
    //         emoji: FranchiseEmote[franchise.slug]
    //     });
    // });

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder();
    subrow.addComponents(selectMenu);

    // interaction.reply({ embeds: [embed], components: [subrow] });
    interaction.reply({ embeds: [embed] });
}