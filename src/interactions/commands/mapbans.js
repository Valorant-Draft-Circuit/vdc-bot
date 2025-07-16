const { EmbedBuilder, ChatInputCommandInteraction, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits, MessageFlags } = require(`discord.js`);
const { ControlPanel, Player } = require(`../../../prisma`);
const { MatchType, MapBanType } = require(`@prisma/client`);
const { prisma } = require(`../../../prisma/prismadb`);
const { CHANNELS } = require(`../../../utils/enums/channels`);

const COLORS = {
    PROSPECT: 0xFEC335,
    APPRENTICE: 0x72C357,
    EXPERT: 0x04AEE4,
    MYTHIC: 0xA657A6,
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
            include: {
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
            }
        });

        // get the next match for the player
        const nextMatch = matches.filter((m) => m.dateScheduled > Date.now()).sort((a, b) => a.dateScheduled - b.dateScheduled)[0];

        // check to not begin too early
        const nextMatchDate = nextMatch.dateScheduled;
        const isWithin12Hours = (new Date(nextMatchDate) - Date.now()) <= 12 * 60 * 60 * 1000;
        if (!isWithin12Hours) return await interaction.editReply(`You cannot begin map bans greater than 12 hours in advance!`);

        const channelName = `bans│${player.Team.tier[0]}│${nextMatch.Home.Franchise.slug}-${nextMatch.Away.Franchise.slug}`.toLowerCase();

        // check channels in the server for if it exists already
        const activebans = (await interaction.guild.channels.fetch())
            .filter(c => c.parentId == CHANNELS.CATEGORIES.MAPBANS)
            .map(c => { return { name: c.name, id: c.id } });
        const banExists = activebans.map(ab => ab.name).includes(channelName);


        // if the channel exists, direct them to it
        if (banExists) return await interaction.editReply({
            content: `The mapban for this match (\`${nextMatch.tier}\` - <${nextMatch.Home.Franchise.Brand.discordEmote}> ${nextMatch.Home.name} vs. <${nextMatch.Away.Franchise.Brand.discordEmote}> ${nextMatch.Away.name}) exists already: <#${activebans.find(ab => ab.name == channelName).id}>`
        });

        // if the ban has already been completed, send this
        if (nextMatch.MapBans.length != 0) return await interaction.editReply({
            content: `The mapbans for this match has already begun and/or completed!`
        });
        // ########################################################################################



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
                `\`Match ID\` : \`${nextMatch.matchID}\`\n` +
                `\`Date\` : ${timeStampString}\n\n` +
                `**Ban Order** :\n${banOrder.map(o => `\`${o}\``).join(`, `)}\n\n` +
                `**Map Pool** :\n${mapPool.map(mp => `\`${mp}\``).join(`, `)}\n`,
            color: COLORS[nextMatch.tier]
        });


        // create database entries
        const dbOut = generateDatabaseInfo(nextMatch.matchID, banOrder, nextMatch.Home, nextMatch.Away);
        await prisma.mapBans.createMany({ data: dbOut });

        // create the channel with the roster permission overrides
        const channelOverrides = [
            nextMatch.Home.Roster.map(p => p.Accounts.find(a => a.provider == `discord`).providerAccountId),
            nextMatch.Away.Roster.map(p => p.Accounts.find(a => a.provider == `discord`).providerAccountId),
        ].flat().map(discordID => {
            return {
                id: discordID,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],

            }
        });

        const bansCategory = interaction.guild.channels.cache.find(c => c.id == CHANNELS.CATEGORIES.MAPBANS);
        const newchannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CHANNELS.CATEGORIES.MAPBANS,
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
        });
    }
    return dbOut;
}
