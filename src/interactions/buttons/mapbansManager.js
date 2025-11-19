const { ButtonInteraction, ButtonBuilder, ActionRowBuilder, MessageFlags, ButtonStyle, MediaGalleryBuilder, MediaGalleryItemBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require(`discord.js`);
const { MapBansSide, MapBanType } = require(`@prisma/client`);
const { prisma } = require(`../../../prisma/prismadb`);
const { Team } = require(`../../../prisma`);

module.exports = {
    id: `mapbansManager`,

    async execute(/** @type ButtonInteraction */ interaction, args) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral }); // defer as early as possible


        // PROCESS ARGS ###########################################################################
        const splitargs = args.split(`-`);
        const matchID = Number(splitargs[1]);


        // if args have delete, process that
        if (splitargs[0] == `delete`) return await deleteChannel(interaction, matchID);
        // ########################################################################################



        // FETCH DATA #############################################################################
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


        const currentSelection = mapbans.find(mb => mb.order == order);
        const nextSelection = mapbans
            .filter(b => b.type == MapBanType.PICK || b.type == MapBanType.DECIDER)
            .find(mb => mb.order == order + 1) == undefined ? mapbans[6] : mapbans.filter(b => b.type == MapBanType.PICK || b.type == MapBanType.DECIDER).find(mb => mb.order == order + 1);
        // ########################################################################################



        // CHECKS #################################################################################
        // check for if the player is allowed/rostered
        const teamIDs = Array.from(new Set(mapbans.map(b => b.team)));
        const pickingTeamID = teamIDs.filter(tid => tid != currentSelection.team)[0];
        const teams = [
            mapbans.find(nb => nb.team == pickingTeamID).Team,
            mapbans.find(nb => nb.team != pickingTeamID).Team
        ];

        const pickingTeam = teams.find(t => t.id == pickingTeamID);
        const roster = (await Team.getRosterBy({ name: pickingTeam.name })).roster;
        const rosterDiscordAccountIDs = roster.map(p => p.Accounts.find(a => a.provider == `discord`)).map(rda => rda.providerAccountId);
        const isOnTeam = rosterDiscordAccountIDs.includes(interaction.member.id);


        if (!isOnTeam) {
            return await Promise.all([
                interaction.deleteReply(),
                interaction.channel.send({ content: `${interaction.member}, you are not a rostered player for \`${pickingTeam.name}\`, and cannot make this selection` })
            ]);
        };
        // ########################################################################################



        // UPDATE DATABASE, GET MAP INFO AND SEND SELECTION #######################################
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
        // I know this is bad.  Ill try fix it later when games are not being played.
        // TODO: Fix capitalization later Pt. 3
        capitalizedMap = currentSelection.map.charAt(0).toUpperCase() + currentSelection.map.slice(1).toLowerCase();
        const mapData = maps.find(m => m.displayName == capitalizedMap);
        const curSelFran = pickingTeam.Franchise;
        await interaction.message.edit({
            content: `<${curSelFran.Brand.discordEmote}> \`${pickingTeam.name}\` select ${sideEmote} \`${side}\` on \`${currentSelection.map}\``,
            components: [],
            files: [mapData.listViewIcon]
        });
        // ########################################################################################

        logger.log(`VERBOSE`, `\`${interaction.user.tag}\` selected \`${side}\` on \`${currentSelection.map}\` as their \`side\` for \`${pickingTeam.name}\` (Match ID: \`${matchID}\`)`);


        // MAPBANS COMPLETE #######################################################################
        if ((nextSelection.type != MapBanType.PICK && (mapbansResponse.type == MapBanType.DECIDER && mapbansResponse.side != null)) || nextSelection.type == MapBanType.DISCARD) {

            const finalMapBans = (await prisma.mapBans.findMany({
                where: { matchID: matchID },
                include: { Team: { include: { Franchise: { include: { Brand: true } } } } }
            })).filter(mb => {
                return mb.type != MapBanType.BAN && mb.type != MapBanType.DISCARD;
            });

            const date = Math.round(Date.parse(mapbansResponse.Match.dateScheduled) / 1000);
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
                // I know this is bad.  Ill try fix it later when games are not being played.
                // TODO: Fix capitalization later Pt. 4
                capitalizedMap = finalData.map.charAt(0).toUpperCase() + finalData.map.slice(1).toLowerCase();
                new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(maps.find(m => m.displayName == capitalizedMap).listViewIcon))


                const sidePickingTeamID = teamIDs.find(tid => tid != finalData.team);
                const sidePickingTeam = teams.find(t => t.id == sidePickingTeamID);
                const mapPickText = finalData.type == MapBanType.DECIDER ?
                    `The decider is \`${finalData.map}\`` :
                    `<${finalData.Team.Franchise.Brand.discordEmote}> \`${finalData.Team.name}\` picks \`${finalData.map}\``;

                components.push(...[
                    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(maps.find(m => m.displayName == capitalizedMap).listViewIcon)),
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
        return await interaction.channel.send({
            content:
                `It's <${nextTeam.Franchise.Brand.discordEmote}> \`${nextTeam.name}\`'s turn to pick a side for \`${nextSelection.map}\`!\n` +
                `-# ||${nextTeam.Roster.map(p => `<@${p.Accounts.find(a => a.provider == `discord`).providerAccountId}>`).join(`, `)}||`,
            components: [subrow]
        });
    }
};

async function deleteChannel(/** @type ButtonInteraction */ interaction, matchID) {

    /** Channel cannot be deleted until n hours until after the scheduled match time. In the future, check for both maps being submitted & auto delete? */
    const ADDITIONAL_TIME = 1 /** hours */ * 60 * 60 * 1000; // in ms

    const match = await prisma.matches.findFirst({ where: { matchID: matchID } });
    const hasMatchPassedPlus1Hour = new Date((match.dateScheduled).getTime() + ADDITIONAL_TIME) < Date.now();

    // TIME ---------------------------------------------------------------
    const date = Math.round((Date.parse(match.dateScheduled) + ADDITIONAL_TIME) / 1000);
    const timeStampString = `<t:${date}:f> (<t:${date}:R>)`; // ex: May 28, 2025 8:00 PM (in 5 days)
    // --------------------------------------------------------------------

    if (!hasMatchPassedPlus1Hour) return await interaction.editReply({ content: `You cannot delete this channel until ${timeStampString}!` });
    else {
        logger.log(`VERBOSE`, `${interaction.user} (\`${interaction.user.username}\`, \`${interaction.user.id}\`) deleted \`${interaction.channel.name}\``);
        return await interaction.channel.delete();
    }
}
