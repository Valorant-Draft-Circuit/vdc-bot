const { ButtonInteraction, EmbedBuilder, ButtonBuilder, ActionRowBuilder, MessageFlags, ButtonStyle, MediaGalleryBuilder, MediaGalleryItemBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require(`discord.js`);
// const { ButtonOptions } = require(`../../../utils/enums`);
// const { updateDescription } = require("../subcommands/franchise");
const { MapBansSide, MapBanType } = require("@prisma/client");
const { prisma } = require("../../../prisma/prismadb");
const { Team } = require("../../../prisma");

module.exports = {
    id: `mapbansManager`,

    async execute(/** @type ButtonInteraction */ interaction, args) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral }); // defer as early as possible

        const splitargs = args.split(`-`);
        const matchID = Number(splitargs[1]);
        console.log(splitargs)

        // channel delete
        if (splitargs[0] == `delete`) return await deleteChannel(interaction, matchID);


        const order = Number(splitargs[2]);
        const side = splitargs[0] == `attack` ? MapBansSide.ATTACK : MapBansSide.DEFENSE;
        const sideEmote = splitargs[0] == `attack` ? `⚔️` : `🛡️`;

        const mapbans = await prisma.mapBans.findMany({
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

        // console.log(mapbans)

        const currentSelection = mapbans.find(mb => mb.order == order);
        const nextSelection = mapbans
            .filter(b => b.type == MapBanType.PICK || b.type == MapBanType.DECIDER)
            .find(mb => mb.order == order + 1) == undefined ? mapbans[6] : mapbans.filter(b => b.type == MapBanType.PICK || b.type == MapBanType.DECIDER).find(mb => mb.order == order + 1);

        // console.log(nextSelection)

        // return

        // console.log(currentSelection, nextSelection);

        // check for if the player is allowed/rostered
        // get the current team
        const teamIDs = Array.from(new Set(mapbans.map(b => b.team)));
        // console.log(teamIDs)
        const pickingTeamID = teamIDs.filter(tid => tid != currentSelection.team)[0];
        // console.log(currentSelection.team, pickingTeamID)
        const teams = [
            mapbans.find(nb => nb.team == pickingTeamID).Team,
            mapbans.find(nb => nb.team != pickingTeamID).Team
        ];

        // console.log(teams)

        const pickingTeam = teams.find(t => t.id == pickingTeamID);

        const roster = (await Team.getRosterBy({ name: pickingTeam.name })).roster;
        const rosterDiscordAccountIDs = roster.map(p => p.Accounts.find(a => a.provider == `discord`)).map(rda => rda.providerAccountId);
        const isOnTeam = rosterDiscordAccountIDs.includes(interaction.member.id);


        if (!isOnTeam) {
            return await Promise.all([
                await interaction.deleteReply(),
                await interaction.channel.send({ content: `${interaction.member}, you are not a rostered player for \`${pickingTeam.name}\`, and cannot make this selection` })
            ]);
        };


        // ####################################################################

        const [mapbansResponse, mapsResponse] = await Promise.all([
            prisma.mapBans.update({
                where: { id: currentSelection.id },
                data: { side: side },
                include: {
                    Match: {
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
                            }
                        }
                    }
                }
            }),
            fetch(`https://valorant-api.com/v1/maps`)
        ]);
        if (!mapsResponse.ok) {
            await interaction.deleteReply();
            return logger.log(`ERROR`, `There was an error fetching map data!`);
        }
        const maps = (await mapsResponse.json()).data;


        // send data for map selection
        const mapData = maps.find(m => m.displayName == currentSelection.map);
        const curSelTeam = pickingTeam;
        const curSelFran = curSelTeam.Franchise;
        await interaction.message.edit({ content: `<${curSelFran.Brand.discordEmote}> \`${curSelTeam.name}\` select ${sideEmote} \`${side}\` on \`${currentSelection.map}\``, components: [], files: [mapData.listViewIcon] });


        // console.log(nextSelection)
        if ((nextSelection.type != MapBanType.PICK && (mapbansResponse.type == MapBanType.DECIDER && mapbansResponse.side != null)) || nextSelection.type == MapBanType.DISCARD) {

            const finalMapBans = (await prisma.mapBans.findMany({
                where: { matchID: matchID },
                include: { Team: { include: { Franchise: { include: { Brand: true } } } } }
            })).filter(mb => {
                return mb.type != MapBanType.BAN && mb.type != MapBanType.DISCARD;
            });

            const date = Math.round(Date.parse(mapbansResponse.Match.dateScheduled) / 1000)
            // const hoursTill = date / (1000 * 60 * 60);
            const timeStampString = `<t:${date}:f> (<t:${date}:R>)`;

            const components = [
                new TextDisplayBuilder({
                    content:
                        `## <${mapbansResponse.Match.Home.Franchise.Brand.discordEmote}> \`${mapbansResponse.Match.Home.name}\` vs. <${mapbansResponse.Match.Away.Franchise.Brand.discordEmote}> \`${mapbansResponse.Match.Away.name}\`\n` +
                        `-# \`${mapbansResponse.Match.tier}\` | Match Day \`${mapbansResponse.Match.matchDay}\` | \`${mapbansResponse.Match.matchType}\` | ${timeStampString}`
                })
            ];

            for (let i = 0; i < finalMapBans.length; i++) {
                const finalData = finalMapBans[i];
                // console.log(finalData)
                // const mapData = maps.find(m => m.displayName == currentSelection.map);
                new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(maps.find(m => m.displayName == finalData.map).listViewIcon))


                const sidePickingTeamID = teamIDs.find(tid => tid != finalData.team);
                const sidePickingTeam = teams.find(t => t.id == sidePickingTeamID);

                // console.log(maps.find(m => m.displayName == finalData.map))

                const mapPickText = finalData.type == MapBanType.DECIDER ? `The decider is \`${finalData.map}\`` : `<${finalData.Team.Franchise.Brand.discordEmote}> \`${finalData.Team.name}\` picks \`${finalData.map}\``;

                components.push(...[
                    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(maps.find(m => m.displayName == finalData.map).listViewIcon)),
                    new TextDisplayBuilder({ content: `Map \`${i + 1}\` : ${mapPickText} — <${sidePickingTeam.Franchise.Brand.discordEmote}> \`${sidePickingTeam.name}\` picks ${finalData.side == MapBansSide.ATTACK ? `⚔️` : `🛡️`} \`${finalData.side}\`` })
                ]);

                if (i < finalMapBans.length - 1) components.push(new SeparatorBuilder({ spacing: SeparatorSpacingSize.Small, divider: true }));
            }

            await interaction.deleteReply();
            await interaction.channel.send({ components: components, flags: MessageFlags.IsComponentsV2 });
            return await interaction.channel.send({
                content: ``,
                components: [new ActionRowBuilder({
                    components: [
                        new ButtonBuilder({
                            customId: `mapbans_delete-${mapbansResponse.matchID}`,
                            style: ButtonStyle.Danger,
                            label: `Delete Channel`
                        })
                    ]
                })]
            });
        }





        // const teamIDs = Array.from(new Set(mapbans.map(nb => nb.Team.id)));
        // const pickingTeamID = teamIDs.filter(tid => tid != firstPick.team)[0];
        // const teams = [
        //     mapbans.find(nb => nb.team == pickingTeamID).Team,
        //     mapbans.find(nb => nb.team != pickingTeamID).Team
        // ];


        const nextTeamID = teamIDs.filter(tid => tid != nextSelection.team)[0];
        const nextTeam = nextTeamID == null ? mapbansResponse.Match.Home : teams.find(t => t.id == nextTeamID);


        const attack = new ButtonBuilder({
            customId: `mapbans_attack-${nextSelection.matchID}-${nextSelection.order}`,
            label: `Attack`,
            style: ButtonStyle.Secondary,
            emoji: `⚔️`
        });

        const defense = new ButtonBuilder({
            customId: `mapbans_defense-${nextSelection.matchID}-${nextSelection.order}`,
            label: `Defense`,
            style: ButtonStyle.Secondary,
            emoji: `🛡️`
        });
        const subrow = new ActionRowBuilder({ components: [attack, defense] });

        await interaction.deleteReply();
        // return await interaction.channel.send({
        //     content: `<@&${nextTeam.Franchise.roleID}>, it's (<${nextTeam.Franchise.Brand.discordEmote}> \`${nextTeam.name}\`)'s turn to pick a side for \`${nextSelection.map}\`!`,
        //     components: [subrow]
        // });
        return await interaction.channel.send({
            content:
                `It's <${nextTeam.Franchise.Brand.discordEmote}> \`${nextTeam.name}\`'s turn to pick a side for \`${nextSelection.map}\`!\n` +
                `-# ||${nextTeam.Roster.map(p => `<@${p.Accounts.find(a => a.provider == `discord`).providerAccountId}>`).join(`, `)}||`,
            components: [subrow]
        });
        // switch (splitargs[0]) {
        //     case `attack`: {

        //     }
        //     case `defense`: {

        //     }
        //     default: {
        //         await interaction.reply({ content: `There was an error. Expected <\`attack\` or \`defense\`> as an argument and got \`${splitargs[0]}\` instead.` })
        //         throw new Error(`Expected <\`attack\` or \`defense\`> as an argument and got \`${splitargs[0]}\` instead.`);
        //     }
        // }
    }
};


// async function cancel(/** @type ChatInputCommandInteraction */ interaction) {
//     // delete the reply and then edit the original embed to show cancellation confirmation
//     await interaction.deleteReply();

//     const embed = interaction.message.embeds[0];
//     const embedEdits = new EmbedBuilder(embed);

//     embedEdits.setDescription(`This operation was cancelled.`);
//     embedEdits.setFields([]);

//     return await interaction.message.edit({
//         embeds: [embedEdits],
//         components: [],
//     });
// }

async function deleteChannel(/** @type ButtonInteraction */ interaction, matchID) {

    const ADDITIONAL_TIME = 60 * 60 * 1000;

    const match = await prisma.matches.findFirst({ where: { matchID: matchID } });
    const hasMatchPassedPlus1Hour = new Date((match.dateScheduled).getTime() + ADDITIONAL_TIME) < Date.now();

    // TIME ---------------------------------------------------------------
    const date = Math.round((Date.parse(match.dateScheduled) + ADDITIONAL_TIME) / 1000);
    const timeStampString = `<t:${date}:f> (<t:${date}:R>)`; // ex: May 28, 2025 8:00 PM (in 5 days)
    // --------------------------------------------------------------------

    if (!hasMatchPassedPlus1Hour) return await interaction.editReply({ content: `You cannot delete this channel until ${timeStampString}!` });
    else interaction.channel.delete();
}
