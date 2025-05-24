const { Collection, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const { prisma } = require(`../../../prisma/prismadb`);
const { StringSelectMenuInteraction } = require(`discord.js`);
const { Team, Player, ControlPanel } = require('../../../prisma');
const { MatchType, MapBanType } = require('@prisma/client');


module.exports = {

    id: `mapbans`,

    async execute(/** @type StringSelectMenuInteraction */ interaction) {
        await interaction.deferUpdate();

        const { values, message } = interaction;







        // get every message in the channel
        const messages = await fetchAllMessages(interaction);
        const firstMessage = messages.last(); /** @note : Discord collections have .last() as the first message because the collection stores the "first" message as the most recent one */


        // get the latest message
        const embedMessage = firstMessage.embeds[0];
        const embedDesc = embedMessage.description;

        // extract data from the embed
        const splitDesc = embedDesc.split(`\n`);
        const allBanOrders = splitDesc[6].replaceAll(`\``, ``).split(`, `);
        const banOrder = allBanOrders.filter(e => !e.includes(`||`));
        const allMaps = splitDesc[9].replaceAll(`\``, ``).split(`, `);
        const matchID = Number(splitDesc[2].match(/`(\d+)/)[1]);
        const homeTeamName = splitDesc[0].split(`\``)[5];
        const awayTeamName = splitDesc[1].split(`\``)[5];

        console.log(homeTeamName, awayTeamName)

        // ban order state (BAN, PICK)
        const currentBanState = banOrder[0];
        const nextBanState = banOrder[1];


        // extract data from the interaction message
        const splitInteractionMessage = message.content.split(`\``);
        const emote = splitInteractionMessage[0].match(/(<:\w+:)\d+>/)[0];
        const teamName = splitInteractionMessage[1];
        const mapBanType = splitInteractionMessage[3];
        const mapSelection = values[0][0].toUpperCase() + values[0].substring(1).toLowerCase();


        // check for if the player is allowed/rostered
        const roster = (await Team.getRosterBy({ name: teamName })).roster;
        const rosterDiscordAccountIDs = roster.map(p => p.Accounts.find(a => a.provider == `discord`)).map(rda => rda.providerAccountId);
        const isOnTeam = rosterDiscordAccountIDs.includes(interaction.member.id);

        if (!isOnTeam) return await interaction.channel.send({ content: `${interaction.member}, you are not a rostered player for \`${teamName}\`, and cannot make this selection` });


        // "cross out" as the map bans progress
        const selectionIndex = allMaps.indexOf(mapSelection);
        allMaps[selectionIndex] = `||${mapSelection}||`;
        const banOrderSelectionIndex = allBanOrders.findIndex(e => !e.includes(`||`));
        allBanOrders[banOrderSelectionIndex] = `||${banOrder[banOrderSelectionIndex]}||`;


        // console.log(splitDesc)
        // console.log(allMaps)

        splitDesc[6] = allBanOrders.map(abo => {
            if (abo.includes(`||`)) {
                const new_abo = abo.replaceAll(`||`, ``);
                return `||\`${new_abo}\`||`;
            } else {
                return `\`${abo}\``;
            }
        }).join(`, `);

        splitDesc[9] = allMaps.map(amps => {
            if (amps.includes(`||`)) {
                const new_amps = amps.replaceAll(`||`, ``);
                return `||\`${new_amps}\`||`;
            } else {
                return `\`${amps}\``;
            }
        }).join(`, `);


        const remainingMaps = splitDesc[9].replaceAll(`\``, ``).split(`, `).filter(e => !e.includes(`||`));

        const embed = embedMessage;
        const embedEdits = new EmbedBuilder(embed);
        embedEdits.setDescription(splitDesc.join(`\n`));
        // const firstMessageFetch = await interaction.channel.messages.fetch({id: firstMessage.id})
        const firstMessageFetch = interaction.channel.messages.cache.get(firstMessage.id);
        await firstMessageFetch.edit({ embeds: [embedEdits] });


        // console.log(splitDesc)

        // console.log(teamName, mapBanType);
        // console.log(matchID);
        // console.log(currentBanState, nextBanState);
        // console.log(remainingMaps);



        // console.log(maps)
        // console.log(mapData)
        const response = await fetch(`https://valorant-api.com/v1/maps`);
        if (!response.ok) return logger.log(`ERROR`, `There was an error fetching map data!`)
        const maps = (await response.json()).data;

        const mapData = maps.find(m => m.displayName == mapSelection);
        // console.log(mapData)


        // if (mapBanType == `PICK`) {
        //     const attack = new ButtonBuilder({
        //         customId: `mapbans_attack`,
        //         label: `attack`,
        //         style: ButtonStyle.Secondary,
        //         emoji: `⚔️`
        //     });

        //     const defense = new ButtonBuilder({
        //         customId: `mapbans_defense`,
        //         label: `defense`,
        //         style: ButtonStyle.Secondary,
        //         emoji: `🛡️`
        //     });
        //     const subrow = new ActionRowBuilder({ components: [attack, defense] });
        //     await interaction.message.edit({ content: `${emote} \`${teamName}\` select \`${mapSelection}\` as their \`${mapBanType}\``, components: [subrow], files: [mapData.listViewIcon] });
        // } else {
        //     await interaction.message.edit({ content: `${emote} \`${teamName}\` select \`${mapSelection}\` as their \`${mapBanType}\``, components: [], files: [mapData.listViewIcon] });
        // }

        await interaction.message.edit({ content: `${emote} \`${teamName}\` select \`${mapSelection}\` as their \`${mapBanType}\``, components: [], files: [mapData.listViewIcon] });


        // STORE DATA #########################################################
        // find the mapbans info
        const banDBEntries = await prisma.mapBans.findMany({
            where: { matchID: matchID },
            include: {
                Team: {
                    include: {
                        Franchise: { include: { Brand: true } },
                        Roster: { include: { Accounts: true } }
                    }
                }
            }
        });
        const nextMapBanEntry = banDBEntries.filter(e => e.map == null)[0];
        const updatedDB = await prisma.mapBans.update({
            where: { id: nextMapBanEntry.id },
            data: { map: mapSelection }
        });


        // if the next state is a DISCARD or DECIDER, end here ################
        if (nextBanState == MapBanType.DISCARD || nextBanState == MapBanType.DECIDER) {

            // update the last map in the database
            const mapData = maps.find(m => m.displayName == remainingMaps[0]);
            await prisma.mapBans.update({
                where: { id: updatedDB.id + 1 },
                data: { map: remainingMaps[0] }
            });

            // send the last map in the mapbans channel
            await interaction.channel.send({ content: `\`${remainingMaps[0]}\` remains as the \`${nextBanState}\``, components: [], files: [mapData.listViewIcon] });

            // get the side selection data
            const nonBans = banDBEntries.filter(e => e.type == MapBanType.PICK || e.type == MapBanType.DECIDER);
            const firstPick = nonBans[0];

            console.log(nonBans)

            const teamIDs = Array.from(new Set(banDBEntries.map(nb => nb.team)));
            const pickingTeamId = teamIDs.filter(tid => tid != firstPick.team)[0];
            const teams = [
                banDBEntries.find(nb => nb.team == pickingTeamId).Team,
                banDBEntries.find(nb => nb.team != pickingTeamId).Team
            ];

            const pickingTeam = teams.find(t => t.id = pickingTeamId);

            const attack = new ButtonBuilder({
                customId: `mapbans_attack-${firstPick.matchID}-${firstPick.order}`,
                label: `Attack`,
                style: ButtonStyle.Secondary,
                emoji: `⚔️`
            });

            const defense = new ButtonBuilder({
                customId: `mapbans_defense-${firstPick.matchID}-${firstPick.order}`,
                label: `Defense`,
                style: ButtonStyle.Secondary,
                emoji: `🛡️`
            });
            const subrow = new ActionRowBuilder({ components: [attack, defense] });

            // return await interaction.channel.send({
            //     content: `<@&${pickingTeam.Franchise.roleID}>, it's (<${pickingTeam.Franchise.Brand.discordEmote}> \`${pickingTeam.name}\`)'s turn to pick a side for \`${firstPick.map}\`!`,
            //     components: [subrow]
            // });
            return await interaction.channel.send({
                content:
                    `It's <${pickingTeam.Franchise.Brand.discordEmote}> \`${pickingTeam.name}\`'s turn to pick a side for \`${firstPick.map}\`!\n` +
                    `-# ||${pickingTeam.Roster.map(p => `<@${p.Accounts.find(a => a.provider == `discord`).providerAccountId}>`).join(`, `)}||`,
                components: [subrow]
            });

            // console.log(nonBans)



        }
        // ####################################################################



        // send the next ban message ##########################################
        // const player = await Player.getBy({ discordID: interaction.user.id });
        // const season = await ControlPanel.getSeason();
        // const matches = await prisma.matches.findMany({
        //     where: {
        //         AND: [
        //             {
        //                 OR: [{ home: player.team }, { away: player.team }
        //                 ]
        //             },
        //             {
        //                 OR: [{ matchType: MatchType.BO2 }, { matchType: MatchType.BO3 }, { matchType: MatchType.BO5 }],
        //             }
        //         ],
        //         season: season,
        //         tier: team.tier
        //     },
        //     include: {
        //         Home: { include: { Franchise: { include: { Brand: true } } } },
        //         Away: { include: { Franchise: { include: { Brand: true } } } },
        //     }
        // });

        const selectionType = nextBanState.split(`_`)[nextBanState.split(`_`).length - 1].toUpperCase();
        // const nextMatch = matches.filter(m => m.dateScheduled > Date.now())[0];
        const nextTeamName = nextBanState.includes(`HOME`) ? homeTeamName : awayTeamName;
        // console.log(nextTeam)
        // const nextTeam = nextBanState.includes(`HOME`) ? homeTeamName : awayTeamName;
        const nextTeam = await Team.getBy({ name: nextTeamName });
        const nextEmote = nextTeam.Franchise.Brand.discordEmote
        // const nextMatchRole = nextTeam.Franchise.roleID;

        const mapOptions = remainingMaps.map(m => {
            return { label: m, value: m.toLowerCase() }
        });

        const mapbansRow = new ActionRowBuilder({
            components: [new StringSelectMenuBuilder({
                customId: `mapbans`,
                placeholder: `${nextTeam.name}'s ${selectionType.toLowerCase()}`,
                options: mapOptions,
            })]
        });

        // return await interaction.channel.send({
        //     content: `<@&${nextMatchRole}>, it's (<${nextEmote}> \`${nextTeam.name}\`)'s turn to \`${selectionType}\`!`,
        //     components: [mapbansRow]
        // });
        return await interaction.channel.send({
            content:
                `It's <${nextEmote}> \`${nextTeam.name}\`'s turn to \`${selectionType}\`!\n` +
                `-# ||${nextTeam.Roster.map(p => `<@${p.Accounts.find(a => a.provider == `discord`).providerAccountId}>`).join(`, `)}||`,
            components: [mapbansRow]
        });
        // ####################################################################


    }
};

async function fetchAllMessages(interaction) {
    const channel = interaction.channel;
    if (!channel || !channel.isTextBased()) return new Collection();

    let allMessages = new Collection();
    let lastId;

    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        allMessages = allMessages.concat(messages);
        lastId = messages.last().id;
    }

    return allMessages;
}