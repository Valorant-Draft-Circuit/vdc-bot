const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder } = require("discord.js");
const { ButtonStyle } = require(`discord.js`)

const { Franchise, Player, Team } = require("../../prisma");
const { TransactionsSubTypes, TransactionsCutOptions, TransactionsSignOptions, TransactionsDraftSignOptions, CHANNELS, PlayerStatusCode, TransactionsUpdateTierOptions, TransactionsRenewOptions } = require(`../../utils/enums/`);

const teamMMRAllowance = {
    prospect: 386,
    apprentice: 538,
    expert: 716,
    mythic: 948
}; // max MMR allowance for teams to "spend" on players
const sum = (array) => array.reduce((s, v) => s += v == null ? 0 : v, 0);

let chan;

module.exports = {

    name: `transactions`,

    async execute(interaction) {
        chan = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);


        const { _subcommand, _hoistedOptions } = interaction.options;
        switch (_subcommand) {
            case `cut`:
                cut(interaction, _hoistedOptions[0]);
                break;
            case `sign`:
                sign(interaction, _hoistedOptions[0], _hoistedOptions[1].value);
                break;
            case `draft-sign`:
                draftSign(interaction, _hoistedOptions[0].value, _hoistedOptions[1].value, _hoistedOptions[2].member, _hoistedOptions[3].value);
                break;
            case `update-tier`:
                updateTier(interaction, _hoistedOptions[0].member, _hoistedOptions[1].value);
                break;
            case `renew`:
                renew(interaction, _hoistedOptions[0], _hoistedOptions[1].value);
                break;
            case `sub`:
                sub(interaction, _hoistedOptions[0].member, _hoistedOptions[1].value);
                break;
            case `unsub`:
                unsub(interaction, _hoistedOptions[0].member);
                break;
            // case `swap`:
            //     swap(interaction, _hoistedOptions[0], _hoistedOptions[1]);
            //     break;
            // case `ir`:
            //     // player = _hoistedOptions[0];
            //     ir(interaction, _hoistedOptions[0]);
            //     break;
            default:
                interaction.reply({ content: `That's not a valid subcommand or this command is a work in progress!` });
                break;
        }
    }
};


async function cut(interaction, player) {
    await interaction.deferReply();
    const playerData = await Player.getBy({ discordID: player.value });

    // checks
    if (playerData == undefined) return interaction.editReply({ content: `This player doesn't exist!`, ephemeral: false });
    if (playerData.team == null) return interaction.editReply({ content: `This player is not on a team!`, ephemeral: false });

    const franchise = await Franchise.getBy({ teamID: playerData.team });
    const team = await Team.getBy({ id: playerData.team });

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
    })

    const confirm = new ButtonBuilder({
        customId: `transactions_${TransactionsCutOptions.CONFIRM}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
    })

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
    return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function sign(interaction, player, teamName) {
    await interaction.deferReply();
    const playerData = await Player.getBy({ discordID: player.value });
    const teamData = await Team.getBy({ name: teamName });
    const franchiseData = await Franchise.getBy({ id: teamData.franchise });


    // checks
    // if (playerData == undefined) return await interaction.editReply({ content: `This player doesn't exist!`, ephemeral: false });
    // if (playerData.status !== PlayerStatusCode.FREE_AGENT) return await interaction.editReply({ content: `This player is not a Free Agent and cannot be signed to ${teamData.name}!`, ephemeral: false });

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
                value: `SIGN\n${player.user}\n\`${player.value}\`\n${teamData.name}\n${franchiseData.name}`,
                inline: true
            }
        ],
        footer: { text: `Transactions — Sign` }
    });

    const cancel = new ButtonBuilder({
        customId: `transactions_${TransactionsSignOptions.CANCEL}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
    })

    const confirm = new ButtonBuilder({
        customId: `transactions_${TransactionsSignOptions.CONFIRM}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
    })

    // create the action row, add the component to it & then editReply with all the data
    const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
    return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function draftSign(interaction, round, pick, player, teamName) {
    await interaction.deferReply();

    const playerData = await Player.getBy({ discordID: player.id });
    const teamData = await Team.getBy({ name: teamName });
    const franchiseData = await Franchise.getBy({ id: teamData.franchise });

    // checks
    if (playerData == undefined) return interaction.editReply({ content: `This player doesn't exist!`, ephemeral: false });
    // if (playerData.status !== PlayerStatusCode.DRAFT_ELIGIBLE) return interaction.editReply({ content: `This player is not Draft Eligible and cannot be pulled from the draft!`, ephemeral: false });

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `Are you sure you perform the following action?`,
        color: 0xE92929,
        fields: [
            {
                name: `\u200B`,
                value: `**Transaction**\n\`  Round/Pick : \`\n\`   Player Tag: \`\n\`    Player ID: \`\n\`         Team: \`\n\`    Franchise: \``,
                inline: true
            },
            {
                name: `\u200B`,
                value: `DRAFT SIGN\n\` ${round} / ${pick} \`\n${player.user}\n\`${player.id}\`\n${teamData.name}\n${franchiseData.name}`,
                inline: true
            }
        ],
        footer: { text: `Transactions — Draft Sign` }
    });

    const cancel = new ButtonBuilder({
        customId: `transactions_${TransactionsDraftSignOptions.CANCEL}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
    })

    const confirm = new ButtonBuilder({
        customId: `transactions_${TransactionsDraftSignOptions.CONFIRM}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
    })

    // create the action row, add the component to it & then editReply with all the data
    const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
    return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function updateTier(interaction, guildMember, newTier) {
    await interaction.deferReply();
    const player = await Player.getBy({ discordID: guildMember.id });


    // checks
    if (player == undefined) return await interaction.editReply({ content: `This player doesn't exist!`, ephemeral: false });
    if (player.status !== PlayerStatusCode.SIGNED) return await interaction.editReply({ content: `This player is not signed to a franchise and therefore cannot be promoted/demoted!`, ephemeral: false });

    const franchise = await Franchise.getBy({ teamID: player.team });
    const franchiseTeams = await Franchise.getTeams({ id: franchise.id });
    const team = await Team.getBy({ id: player.team });

    // ensure that the player isn't being updaeted to the same team and that the franchise has an active team in the tier the player is being promotes/demoted to
    if (team.tier === newTier) return await interaction.editReply({ content: `This player is already in the tier you're trying to promote/demote them to (${newTier})`, ephemeral: false });
    if (!franchiseTeams.map(t => t.tier).includes(newTier)) return await interaction.editReply({ content: `${franchise.name} does not have an active team in the ${newTier} tier!`, ephemeral: false });


    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `Are you sure you perform the following action?`,
        color: 0xE92929,
        fields: [
            {
                name: `\u200B`,
                value: `**Transaction**\n\`  Player Tag: \`\n\`   Player ID: \`\n\`    Old Tier: \`\n\`    New Tier: \``,
                inline: true
            },
            {
                name: `\u200B`,
                value: `UPDATE TIER\n${guildMember}\n\`${guildMember.id}\`\n${team.tier}\n${newTier}`,
                inline: true
            }
        ],
        footer: { text: `Transactions — Update Tier` }
    });

    const cancel = new ButtonBuilder({
        customId: `transactions_${TransactionsUpdateTierOptions.CANCEL}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
    })

    const confirm = new ButtonBuilder({
        customId: `transactions_${TransactionsUpdateTierOptions.CONFIRM}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
    })

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
    return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function renew(interaction, player, teamName) {
    // get all info
    const playerData = await Player.getBy({ discordID: player.value });
    const teamData = await Team.getBy({ name: teamName });
    const franchiseData = await Franchise.getBy({ id: teamData.franchise });

    // checks
    if (playerData == undefined) return interaction.reply({ content: `This player doesn't exist!`, ephemeral: false });
    if (playerData.status !== PlayerStatusCode.SIGNED) return interaction.reply({ content: `This player is not signed and cannot have their contract renewed!`, ephemeral: false });
    if (playerData.team !== teamData.id) return interaction.reply({ content: `This player is not on ${franchiseData.name}'s ${teamData.tier} team (${franchiseData.slug} | ${teamName}) and cannot have their contract renewed!`, ephemeral: false });

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
                value: `RENEW\n${player.user}\n\`${player.value}\`\n${teamData.name}\n${franchiseData.name}`,
                inline: true
            }
        ],
        footer: { text: `Transactions — Renew` }
    });

    const cancel = new ButtonBuilder({
        customId: `transactions_${TransactionsRenewOptions.CANCEL}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
        // emoji: `❌`,
    })

    const confirm = new ButtonBuilder({
        customId: `transactions_${TransactionsRenewOptions.CONFIRM}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
        // emoji: `✔`,
    })

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
    interaction.reply({ embeds: [embed], components: [subrow] });
}

async function sub(interaction, player, teamName) {
    await interaction.deferReply();

    const playerData = await Player.getBy({ discordID: player.id });
    const teamData = await Team.getBy({ name: teamName });
    const roster = await Team.getRosterBy({ name: teamName });
    const franchiseData = await Franchise.getBy({ id: teamData.franchise });

    const totalMMR = roster.map(mmr => mmr.MMR_Player_MMRToMMR.mmr_overall)
    console.log(sum(totalMMR))


    const activeSubTime = 8 /* Hours a sub is active for the team */ * 60 * 60; // conversion to milliseconds
    const unsubTime = Math.round(Date.now() / 1000)+ activeSubTime;

    // await interaction.editReply({ content: `Sub Time: <t:${Math.floor(Date.now() / 1000)}:R>\nUnsub Time: <t:${Math.floor(Date.now() / 1000) + activeSubTime}:R>` })


    // checks
    if (playerData == undefined) return await interaction.editReply({ content: `This player doesn't exist!`, ephemeral: false });
    if ([PlayerStatusCode.FREE_AGENT, PlayerStatusCode.RESTRICTED_FREE_AGENT].includes(player.status)) return await interaction.editReply({ content: `This player is not a Free Agent/Restricted Free Agent and cannot be signed to ${teamData.name}!`, ephemeral: false });

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `Are you sure you perform the following action?`,
        color: 0xE92929,
        fields: [
            {
                name: `\u200B`,
                value: `**Transaction**\n\`  Player Tag: \`\n\`   Player ID: \`\n\`        Team: \`\n\`   Franchise: \`\n\`  Unsub Time: \``,
                inline: true
            },
            {
                name: `\u200B`,
                value: `SUB\n${player.user}\n\`${player.id}\`\n${teamData.name}\n${franchiseData.name}\n<t:${unsubTime}:t> (<t:${unsubTime}:R>)`,
                inline: true
            }
        ],
        footer: { text: `Transactions — Sub` }
    });

    const cancel = new ButtonBuilder({
        customId: `transactions_${TransactionsSubTypes.CANCEL}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
    })

    const confirm = new ButtonBuilder({
        customId: `transactions_${TransactionsSubTypes.CONFIRM_SUB}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
    })

    // create the action row, add the component to it & then editReply with all the data
    const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
    return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

function unsub(interaction, player) {
    // unsub
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
