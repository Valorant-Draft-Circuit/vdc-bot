const { EmbedBuilder, ChatInputCommandInteraction, ButtonInteraction, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require(`discord.js`);
const { ControlPanel, Player } = require(`../../../prisma`);
const { MatchType, MapBanType, VetoSource } = require(`@prisma/client`);
const { prisma } = require(`../../../prisma/prismadb`);
const { CHANNELS } = require(`../../../utils/enums/channels`);
const { COLORS } = require(`../../../utils/enums/colors`);

const matchInclude = {
    Home: {
        include: {
            Franchise: { include: { Brand: true } },
            Roster: { include: { Accounts: true } }
        }
    },
    Away: {
        include: {
            Franchise: { include: { Brand: true } },
            Roster: { include: { Accounts: true } }
        }
    },
    MapBans: true
};

module.exports = {

    name: `mapbans`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        // PLAYER CHECKS ##########################################################################
        const player = await Player.getBy({ discordID: interaction.user.id });
        if (player == null) return await interaction.editReply(`You are not in our database!`);
        if (player.team == null) return await interaction.editReply(`You are not on a team!`);

        // ########################################################################################



        // EXIST CHECKS ###########################################################################
        // grab player team and the team's matches
        const season = await ControlPanel.getSeason();
        const matches = await prisma.matches.findMany({
            where: {
                AND: [
                    {
                        OR: [{ home: player.team }, { away: player.team }]
                    },
                    {
                        OR: [
                            { matchType: MatchType.BO2 },
                            { matchType: MatchType.BO3 },
                            { matchType: MatchType.BO5 }
                        ]
                    }
                ],
                season: season,
                tier: player.Team.tier
            },
            include: matchInclude
        });

        // get the next match for the player
        const nextMatch = matches.filter((m) => m.dateScheduled > Date.now()).sort((a, b) => a.dateScheduled - b.dateScheduled)[0];

        // check to not begin too early
        const nextMatchDate = nextMatch.dateScheduled;
        const isWithin12Hours = (new Date(nextMatchDate) - Date.now()) <= 12 * 60 * 60 * 1000;
        if (!isWithin12Hours) return await interaction.editReply(`You cannot begin map bans greater than 12 hours in advance!`);

        const blocker = await findVetoBlocker(interaction, nextMatch);
        if (blocker) return await interaction.editReply({ content: blocker });
        // ########################################################################################



        // SOURCE CHOICE ###########################################################################
        const date = Math.round(Date.parse(nextMatch.dateScheduled) / 1000);
        const matchPageUrl = `https://vdc.gg/match/${nextMatch.matchID}`;

        const venueRow = new ActionRowBuilder({
            components: [
                new ButtonBuilder({ customId: `mapbans_botstart-${nextMatch.matchID}`, label: `Continue on Discord`, style: ButtonStyle.Primary }),
                new ButtonBuilder({ label: `Ban on the website`, style: ButtonStyle.Link, url: matchPageUrl }),
            ]
        });

        return await interaction.editReply({
            content: `Map bans for \`${nextMatch.tier}\`. <${nextMatch.Home.Franchise.Brand.discordEmote}> ${nextMatch.Home.name} vs. <${nextMatch.Away.Franchise.Brand.discordEmote}> ${nextMatch.Away.name} (<t:${date}:f>).\n` +
                `Run them here on Discord, or head to the match page to ban on the website.`,
            components: [venueRow]
        });
        // ########################################################################################
    },

    beginBotVeto: beginBotVeto,
}

async function beginBotVeto(/** @type ButtonInteraction */ interaction, matchID) {
    const nextMatch = await prisma.matches.findUnique({
        where: { matchID: matchID },
        include: matchInclude
    });
    if (nextMatch == null) return await interaction.editReply(`Could not find match \`${matchID}\`!`);

    // the veto may have started elsewhere (web or another player) between the prompt and this click
    const blocker = await findVetoBlocker(interaction, nextMatch);
    if (blocker) return await interaction.editReply({ content: blocker });

    // DATA PULL ##############################################################################
    const [banOrderStr, mapPoolStr] = await Promise.all([
        ControlPanel.getBanOrder(nextMatch.matchType),
        ControlPanel.getMapPool()
    ]);
    const banOrder = banOrderStr.split(`,`);
    const mapPool = mapPoolStr.split(`,`);

    // TIME ---------------------------------------------------------------
    const date = Math.round(Date.parse(nextMatch.dateScheduled) / 1000);
    const timeStampString = `<t:${date}:f> (<t:${date}:R>)`; // ex: May 28, 2025 8:00 PM (in 5 days)
    // --------------------------------------------------------------------
    // ########################################################################################



    // CHANNEL CREATION #######################################################################
    const embed = new EmbedBuilder({
        title: `Map Bans: <${nextMatch.Home.Franchise.Brand.discordEmote}> ${nextMatch.Home.name} vs. <${nextMatch.Away.Franchise.Brand.discordEmote}> ${nextMatch.Away.name}`,
        description:
            `\`Home\` : <${nextMatch.Home.Franchise.Brand.discordEmote}> \`${nextMatch.Home.Franchise.slug.padStart(3, ` `)}\` - \`${nextMatch.Home.name}\`\n` +
            `\`Away\` : <${nextMatch.Away.Franchise.Brand.discordEmote}> \`${nextMatch.Away.Franchise.slug.padStart(3, ` `)}\` - \`${nextMatch.Away.name}\`\n` +
            `\`Match ID\` : [\`${nextMatch.matchID}\`](https://vdc.gg/match/${nextMatch.matchID})\n` +
            `\`Date\` : ${timeStampString}\n\n` +
            `**Ban Order** :\n${banOrder.map(o => `\`${o}\``).join(`, `)}\n\n` +
            `**Map Pool** :\n${mapPool.map(mp => `\`${mp}\``).join(`, `)}\n`,
        color: COLORS[nextMatch.tier]
    });


    // create the channel with the roster permission overrides
    const channelOverrides = await buildRosterOverrides(interaction.guild, [nextMatch.Home, nextMatch.Away]);

    const bansCategory = interaction.guild.channels.cache.find(c => c.id == CHANNELS.CATEGORIES.MAPBANS);
    const newchannel = await interaction.guild.channels.create({
        name: vetoChannelName(nextMatch),
        type: ChannelType.GuildText,
        parent: CHANNELS.CATEGORIES.MAPBANS,
        topic: `Match ID: ${nextMatch.matchID} | Home: <${nextMatch.Home.Franchise.Brand.discordEmote}> ${nextMatch.Home.name} | Away: <${nextMatch.Away.Franchise.Brand.discordEmote}> ${nextMatch.Away.name}`,
        permissionOverwrites: [
            ...channelOverrides,
            ...bansCategory.permissionOverwrites.cache.map((p) => {
                return {
                    id: p.id,
                    allow: p.allow,
                    deny: p.deny,
                };
            })
        ]
    });
    await newchannel.send({ embeds: [embed] });

    // written only once the channel exists so a failed creation leaves no rows blocking a retry
    const dbOut = generateDatabaseInfo(nextMatch.matchID, banOrder, nextMatch.Home, nextMatch.Away);
    await prisma.mapBans.createMany({ data: dbOut });

    await prisma.mapBans.updateMany({
        where: { matchID: nextMatch.matchID },
        data: { vetoUrl: `https://discord.com/channels/${interaction.guild.id}/${newchannel.id}` }
    });
    // ########################################################################################



    // send the next ban message ##############################################################
    const isHome = banOrder[0].toUpperCase().includes(`HOME`);
    const selectionType = banOrder[0].split(`_`)[banOrder[0].split(`_`).length - 1].toUpperCase();
    const nextTeam = isHome ? nextMatch.Home : nextMatch.Away;
    const nextEmote = nextTeam.Franchise.Brand.discordEmote;

    const mapOptions = mapPool.map(m => {
        return { label: m, value: m.toLowerCase() }
    });

    const mapbansRow = new ActionRowBuilder({
        components: [new StringSelectMenuBuilder({
            customId: `mapbans`,
            placeholder: `${nextTeam.name}'s ${selectionType.toLowerCase()}`,
            options: mapOptions,
        })]
    });

    await newchannel.send({
        content: `It's <${nextEmote}> \`${nextTeam.name}\`'s turn to \`${selectionType}\`!\n` +
            `-# ||${nextTeam.Roster.map(p => `<@${p.Accounts.find(a => a.provider == `discord`).providerAccountId}>`).join(`, `)}||`,
        components: [mapbansRow]
    });

    logger.log(`VERBOSE`, `${interaction.user} (\`${interaction.user.username}\`, \`${interaction.user.id}\`) began mapbans for \`${nextMatch.tier}\` Match Day \`${nextMatch.matchDay}\` — \`${nextMatch.Home.name}\` vs. \`${nextMatch.Away.name}\` (Match ID: \`${nextMatch.matchID}\`)`);
    return await interaction.editReply({ content: `Mapbans for \`${nextMatch.tier}\` Match Day \`${nextMatch.matchDay}\` — \`${nextMatch.Home.name}\` vs. \`${nextMatch.Away.name}\` have been created here: ${newchannel}` });
    // ########################################################################################
}

// permission overwrites only resolve for members discord can see, so roster
// players who left (or were never in) the server are fetched out and skipped
async function buildRosterOverrides(guild, teams) {
    const rosterDiscordIDs = teams
        .flatMap(team => team.Roster)
        .map(player => player.Accounts.find(a => a.provider == `discord`)?.providerAccountId)
        .filter(discordID => discordID != null);

    const members = await Promise.all(rosterDiscordIDs.map(discordID => guild.members.fetch(discordID).catch(() => null)));
    const presentMembers = members.filter(member => member != null);

    const missingCount = rosterDiscordIDs.length - presentMembers.length;
    if (missingCount > 0) logger.log(`WARNING`, `${missingCount} of ${rosterDiscordIDs.length} roster players are not in the server & were skipped for the mapban channel overrides`);

    return presentMembers.map(member => {
        return {
            id: member.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        }
    });
}

function vetoChannelName(match) {
    return `bans│${match.tier[0]}│${match.Home.Franchise.slug}-${match.Away.Franchise.slug}`.toLowerCase();
}

async function findVetoBlocker(interaction, match) {
    const channelName = vetoChannelName(match);
    const activebans = (await interaction.guild.channels.fetch())
        .filter(c => c.parentId == CHANNELS.CATEGORIES.MAPBANS)
        .map(c => { return { name: c.name, id: c.id } });
    const existingChannel = activebans.find(ab => ab.name == channelName);

    // if the channel exists, direct them to it
    if (existingChannel) return `The mapban for this match (\`${match.tier}\` - <${match.Home.Franchise.Brand.discordEmote}> ${match.Home.name} vs. <${match.Away.Franchise.Brand.discordEmote}> ${match.Away.name}) exists already: <#${existingChannel.id}>`;

    // if the ban has already begun/completed, direct them to wherever it lives
    if (match.MapBans.length != 0) {
        const isWebOwned = match.MapBans.some(mb => mb.source == VetoSource.WEB);
        const webUrl = match.MapBans.find(mb => mb.vetoUrl != null)?.vetoUrl;
        if (isWebOwned && webUrl) return `The mapbans for this match are running on the website: ${webUrl}`;
        return `The mapbans for this match has already begun and/or completed!`;
    }

    return null;
}

function generateDatabaseInfo(matchID, banOrder, home, away) {
    let dbOut = [];
    for (let i = 0; i < banOrder.length; i++) {

        const currentMapBanState = banOrder[i];

        // isolate MapBanType & cast to type
        let type;
        if (currentMapBanState.includes(`PICK`)) type = MapBanType.PICK;
        if (currentMapBanState.includes(`BAN`)) type = MapBanType.BAN;
        if (currentMapBanState.includes(`DISCARD`)) type = MapBanType.DISCARD;
        if (currentMapBanState.includes(`DECIDER`)) type = MapBanType.DECIDER;

        const teamID = currentMapBanState.includes(`HOME`) ? home.id : away.id;
        const isDefault = currentMapBanState.includes(`DISCARD`) || currentMapBanState.includes(`DECIDER`);

        dbOut.push({
            matchID: matchID,
            order: i,
            type: type,
            team: isDefault ? null : teamID,
            source: VetoSource.BOT,
        });
    }
    return dbOut;
}
