const { LeagueStatus, } = require(`@prisma/client`);

const { Franchise, Player, ControlPanel } = require(`../../../../prisma`);
const { EmbedBuilder, ChatInputCommandInteraction, ButtonStyle, ButtonBuilder, ActionRowBuilder, ButtonInteraction } = require(`discord.js`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { CHANNELS, ButtonOptions } = require(`../../../../utils/enums`);
const { refreshDraftBoardChannel } = require("./refreshDraftBoardChannel");

const draftableLeagueStatuses = [LeagueStatus.FREE_AGENT, LeagueStatus.DRAFT_ELIGIBLE];


// const timeoutLength = 8 * 60 * 1000;
// const timeoutLength = 5 * 1000;

// let timeoutState = false;
// const TIER_TIMEOUT = {
//     PROSPECT: undefined,
//     APPRENTICE: undefined,
//     EXPERT: undefined,
//     MYTHIC: undefined,
// }

const TIER_DRAFT_ENABLE = {
    PROSPECT: false,
    APPRENTICE: false,
    EXPERT: false,
    MYTHIC: false,
}

const COLORS = {
    PROSPECT: 0xFEC335,
    APPRENTICE: 0x72C357,
    EXPERT: 0x04AEE4,
    MYTHIC: 0xA657A6,
}

async function beginOfflineDraft(/** @type ChatInputCommandInteraction */ interaction, tier) {

    if (TIER_DRAFT_ENABLE[tier]) return await interaction.editReply(`The ${tier} draft has already begun!`);
    else TIER_DRAFT_ENABLE[tier] = true;

    // get season, tier & bounds
    const season = await ControlPanel.getSeason();

    // get the draft board
    const draftBoard = (await prisma.draft.findMany({
        where: { AND: [{ season: season }, { tier: tier }, { userID: null }, { round: { not: 99 } }] },
        include: { Franchise: true },
    })).sort((a, b) => a.pick - b.pick).sort((a, b) => a.round - b.round);
    const pick = draftBoard[0];

    // get GMs
    const drafterUserFilter = [pick.Franchise.gmID, pick.Franchise.agm1ID, pick.Franchise.agm2ID, pick.Franchise.agm3ID]
        .filter(id => id !== null)
        .map(id => { return { id: id } });

    // get accounts for all the GMs and AGMS
    const drafterUser = await prisma.user.findMany({
        where: { OR: drafterUserFilter },
        include: { Accounts: true }
    })
    const nextDraftersDiscordIDs = drafterUser.map(ndu => ndu.Accounts.find(a => a.provider == `discord`).providerAccountId)

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC ${tier} Draft` },
        description: `Welcome to the Season ${season} ${tier} draft!`,
        color: COLORS[tier],
        footer: { text: `Draft — ${tier}` }
    });


    await interaction.editReply({ embeds: [embed], components: [] });
    return await interaction.channel.send(`Hey, ${nextDraftersDiscordIDs.map(nddi => `<@${nddi}>`).join(`, `)}! It's \`${pick.Franchise.name}\`'s turn to draft for for their round \`${pick.round}\`, pick \`${pick.pick}\` slot!`);

}

// async function setTimerState(/** @type ChatInputCommandInteraction */ interaction, state) {
//     return await interaction.editReply(`The timer has been ${state ? `enabled`: `disabled`}!`);
// }

async function draftPlayer(/** @type ChatInputCommandInteraction */ interaction, discordID) {

    // check to see if the draft is open
    const offlineDraftOpen = await ControlPanel.getOfflineDraftState();
    const season = await ControlPanel.getSeason();
    if (offlineDraftOpen === false) return await interaction.editReply(`The offline draft is not open yet`);

    // get tier & bounds
    const tierID = interaction.channelId;
    const tier = Object.entries(CHANNELS.DRAFT_CHANNEL).find(e => e[1] === tierID)[0];
    const tierBounds = (await ControlPanel.getMMRCaps(`PLAYER`))[tier];
    // if (!TIER_DRAFT_ENABLE[tier]) return await interaction.editReply(`The ${tier} draft has not begun yet!`);

    // get all draftable players & filter to make sure they have an MMR and fall within the MMR range for the tier
    const draftablePlayers = (await Player.filterAllByStatus(draftableLeagueStatuses))
        .filter(dp => dp.primaryRiotAccountID !== null)
        .filter(dp => dp.PrimaryRiotAccount.mmr !== null)
        .filter(dp => dp.PrimaryRiotAccount.MMR.mmrEffective >= tierBounds.min &&
            dp.PrimaryRiotAccount.MMR.mmrEffective <= tierBounds.max
        );

    // get the draft board and the current pick
    const fullDraftBoard = await prisma.draft.findMany({
        where: { AND: [{ season: season }, { tier: tier }, { round: { not: 99 } }] },
        include: { Franchise: true },
    })
    const draftBoard = (await prisma.draft.findMany({
        where: { AND: [{ season: season }, { tier: tier }, { userID: null }, { round: { not: 99 } }] },
        include: { Franchise: true },
    })).sort((a, b) => a.pick - b.pick).sort((a, b) => a.round - b.round);
    const pick = draftBoard[0];

    if (draftBoard.length == 0 || draftablePlayers.length == 0) return await interaction.editReply(`There are no more draftable players or available draft slots, and so the season ${season} ${tier} draft has concluded!`);

    // check to make sure the drafter is allowed to draft for this tier
    // const drafterDiscordID = interaction.user.id;
    // const drafter = await Player.getBy({ discordID: drafterDiscordID });
    // const allowedDrafters = [pick.Franchise.gmID, pick.Franchise.agm1ID, pick.Franchise.agm2ID].filter(id => id !== null);
    // if (!allowedDrafters.includes(drafter.id)) return await interaction.editReply(`You are not a GM or AGM of ${pick.Franchise.name} and cannot draft for this pick.`);

    // check to make sure the player is draftable
    const player = await Player.getBy({ discordID: discordID });
    const riotAccount = player.PrimaryRiotAccount;
    const mmrEffective = riotAccount.MMR.mmrEffective;

    console.log(fullDraftBoard[0])

    if (draftBoard.map(db => db.userID).includes(player.id)) return await interaction.editReply(`The player you're trying to draft has already been picked up by another franchise and cannot be drafted by yours.`);
    if (!draftableLeagueStatuses.includes(player.Status.leagueStatus)) return await interaction.editReply(`The player you're trying to draft is not \`Draft Eligible\` or a \`FREE_AGENT\` and cannot be drafted.`);
    if (player.primaryRiotAccountID == null) return await interaction.editReply(`This player does not have a primary Riot account set and cannot be drafted.`);
    if (riotAccount.mmr == null) return await interaction.editReply(`This player does not have an MMR entry and cannot be drafted.`);
    if (riotAccount.MMR.mmrEffective == null) return await interaction.editReply(`This player does not have an \`mmrEffective\` value and cannot be drafted.`);
    if (mmrEffective < tierBounds.min || mmrEffective > tierBounds.max) return await interaction.editReply(`This player's effectiveMMR (${mmrEffective}) does not fall within the tier bounds for ${tier} (${tierBounds.min} - ${tierBounds.max}) and cannot be drafted in this tier!`);

    const franchise = await Franchise.getBy({ id: pick.franchise })
    const team = franchise.Teams.find(t => t.tier == tier);

    const fields = [
        `Player Tag : `,
        `Player ID : `,
        `Riot IGN : `,
        `Team : `,
        `Franchise : `,
        `Pick : `,
        `MMR : `,
        ``,
        `Franchise ID : `,
        `Pick ID : `
    ].map(f => `\`${f.padStart(20, ` `)}\``)

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC ${tier} Draft` },
        description: `Are you sure you want to draft the following player?`,
        color: COLORS[tier],
        fields: [
            {
                name: `\u200B`,
                value: fields.join(`\n`),
                inline: true
            },
            {
                name: `\u200B`,
                value: `<@${discordID}>\n\`${discordID}\`\n\`${player.PrimaryRiotAccount.riotIGN}\`\n\`${team.name}\`\n\`${franchise.name}\`\nR: \`${pick.round}\`, P: \`${pick.pick}\`\n\`${mmrEffective}\`\n\n\`${franchise.id}\`\n\`${pick.id}\``,
                inline: true
            }
        ],
        footer: { text: `Draft — ${tier}` }
    });

    const cancel = new ButtonBuilder({
        customId: `draft_${ButtonOptions.DRAFT_CANCEL}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
    });

    const confirm = new ButtonBuilder({
        customId: `draft_${ButtonOptions.DRAFT_CONFIRM}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
    });

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
    return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function cancelDraft(/** @type ButtonInteraction */ interaction) {
    // get season, tier & bounds
    // const season = await ControlPanel.getSeason();
    // const tierID = interaction.channelId;
    // const tier = Object.entries(CHANNELS.DRAFT_CHANNEL).find(e => e[1] === tierID)[0];

    // get the draft board and the current pick
    // const draftBoard = (await prisma.draft.findMany({
    //     where: { AND: [{ season: season }, { tier: tier }, { userID: null }, { round: { not: 99 } }] },
    //     include: { Franchise: true },
    // })).sort((a, b) => a.pick - b.pick).sort((a, b) => a.round - b.round);
    // const pick = draftBoard[0];

    // check to make sure the drafter is allowed to draft for this tier (if they aren't they can't cancel)
    // const drafterDiscordID = interaction.user.id;
    // const drafter = await Player.getBy({ discordID: drafterDiscordID });
    // const allowedDrafters = [pick.Franchise.gmID, pick.Franchise.agm1ID, pick.Franchise.agm2ID].filter(id => id !== null);
    // if (!allowedDrafters.includes(drafter.id)) return await interaction.editReply(`You are not a GM or AGM of ${pick.Franchise.name} and cannot cancel this draft pick.`);

    // delete the reply...
    await interaction.deleteReply();

    // ... create the new embed & edit it to show the cancellation message....
    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);
    embedEdits.setDescription(`This selection was cancelled by <@${interaction.user.id}>.`);
    embedEdits.setFields([]);

    // ... and send it off! (and also remove the buttons)
    return await interaction.message.edit({
        embeds: [embedEdits],
        components: [],
    });
}

async function executeDraft(/** @type ButtonInteraction */ interaction) {
    // get season, tier & bounds
    const season = await ControlPanel.getSeason();
    const tierID = interaction.channelId;
    const tier = Object.entries(CHANNELS.DRAFT_CHANNEL).find(e => e[1] === tierID)[0];

    // get the draft board and the current pick
    const draftBoard = (await prisma.draft.findMany({
        where: { AND: [{ season: season }, { tier: tier }, { userID: null }, { round: { not: 99 } }] },
        include: { Franchise: true },
    })).sort((a, b) => a.pick - b.pick).sort((a, b) => a.round - b.round);
    // const pick = draftBoard[0];
    const nextPick = draftBoard[1];
    console.log(nextPick)

    // check to make sure the drafter is allowed to draft for this tier  (if they aren't they can't confirm)
    // const drafterDiscordID = interaction.user.id;
    // const drafter = await Player.getBy({ discordID: drafterDiscordID });
    // const allowedDrafters = [pick.Franchise.gmID, pick.Franchise.agm1ID, pick.Franchise.agm2ID].filter(id => id !== null);
    // if (!allowedDrafters.includes(drafter.id)) return await interaction.editReply(`You are not a GM or AGM of ${pick.Franchise.name} and so you cannot confirm this draft pick.`);


    const nextDrafters = [nextPick.Franchise.gmID, nextPick.Franchise.agm1ID, nextPick.Franchise.agm2ID, nextPick.Franchise.agm3ID]
        .filter(id => id !== null)
        .map(id => { return { id: id } });

    // console.log(nextDrafters)
    const nextDrafterUsers = await prisma.user.findMany({
        where: { OR: nextDrafters },
        include: { Accounts: true }
    })

    const nextDraftersDiscordIDs = nextDrafterUsers.map(ndu => ndu.Accounts.find(a => a.provider == `discord`).providerAccountId)
    // console.log(discordIDs)
    // console.log(nextDrafterUsers.map(u=> u.))


    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
    const drafteeID = data[1];
    const franchiseID = Number(data[8]);
    const pickID = Number(data[9]);


    console.log(drafteeID, franchiseID, pickID)

    const draftee = await Player.getBy({ discordID: drafteeID });

    const updatedPick = await prisma.draft.update({
        where: { id: pickID },
        data: { userID: draftee.id },
        include: { Franchise: { include: { Brand: true } } }
    });

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC ${tier} Draft` },
        description: `${updatedPick.Franchise.name} has picked up <@${drafteeID}> (\`${draftee.PrimaryRiotAccount.riotIGN}\`) for their round \`${updatedPick.round}\`, pick \`${updatedPick.pick}\` slot!`,
        color: COLORS[tier],
        footer: { text: `Draft — ${tier}` }
    });

    const tierBounds = (await ControlPanel.getMMRCaps(`PLAYER`))[tier];

    // get all draftable players & filter to make sure they have an MMR and fall within the MMR range for the tier
    const draftablePlayers = (await Player.filterAllByStatus(draftableLeagueStatuses))
        .filter(dp => dp.primaryRiotAccountID !== null)
        .filter(dp => dp.PrimaryRiotAccount.mmr !== null)
        .filter(dp => dp.PrimaryRiotAccount.MMR.mmrEffective >= tierBounds.min &&
            dp.PrimaryRiotAccount.MMR.mmrEffective <= tierBounds.max
        );

    if (draftBoard.length == 0 || draftablePlayers.length == 0) return await interaction.editReply(`There are no more draftable players or available draft slots, and so the season ${season} ${tier} draft has concluded!`);

    await interaction.channel.send(`Hey, ${nextDraftersDiscordIDs.map(nddi => `<@${nddi}>`).join(`, `)}! It's \`${nextPick.Franchise.name}\`'s turn to draft for for their round \`${nextPick.round}\`, pick \`${nextPick.pick}\` slot!`);
    await interaction.editReply(`Success!`)
    // await refreshDraftBoardChannel(interaction);
    return await interaction.message.edit({ embeds: [embed], components: [] });
}

// async function executeDefaultPick() {

// }

module.exports = {
    beginOfflineDraft: beginOfflineDraft,
    // setTimerState: setTimerState,
    draftPlayer: draftPlayer,
    cancelDraft: cancelDraft,
    executeDraft: executeDraft
}
