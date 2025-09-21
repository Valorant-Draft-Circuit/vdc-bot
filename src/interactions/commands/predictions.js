const { ChatInputCommandInteraction, Poll, PollLayoutType, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } = require(`discord.js`);

const { updateFranchiseManagement, refreshFranchisesChannel } = require(`../subcommands/league`);
const { CHANNELS } = require("../../../utils/enums");
const { prisma } = require("../../../prisma/prismadb");
const { MatchType } = require("@prisma/client");
const { ControlPanel } = require("../../../prisma");

const { COLORS } = require("../../../utils/enums/colors");


module.exports = {

    name: `predictions`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply({ ephemeral: true });

        const options = interaction.options._hoistedOptions;
        const tier = options.find(o => o.name == `tier`).value;
        const day = Number(options.find(o => o.name == `matchday`).value);


        const season = await ControlPanel.getSeason();
        const matches = await prisma.matches.findMany({
            where: {
                tier: tier,
                matchDay: day,
                season: season
            },
            include: {
                Home: { include: { Franchise: { include: { Brand: true } } } },
                Away: { include: { Franchise: { include: { Brand: true } } } },
                Games: true
            }
        });

        if (matches.length == 0) return await interaction.editReply(`Matchday ${day} has no matches to make predictions on!`);

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const home = match.Home;
            const away = match.Away;

            const homePlayed = (await prisma.matches.findMany({
                where: {
                    OR: [
                        { home: home.id },
                        { away: home.id },
                    ],
                    season: season,
                    matchType: MatchType.BO2,
                },
                include: {
                    Games: true,
                    Home: { include: { Franchise: { include: { Brand: true } } } },
                    Away: { include: { Franchise: { include: { Brand: true } } } },
                },
            })).filter(g => g.Games.length !== 0);


            const awayPlayed = (await prisma.matches.findMany({
                where: {
                    OR: [
                        { home: away.id },
                        { away: away.id },
                    ],
                    season: season,
                    matchType: MatchType.BO2,
                },
                include: {
                    Games: true,
                    Home: { include: { Franchise: { include: { Brand: true } } } },
                    Away: { include: { Franchise: { include: { Brand: true } } } },
                },
            })).filter(g => g.Games.length !== 0);


            const date = Date.parse(match.dateScheduled) - Date.now();
            const hoursTill = date / (1000 * 60 * 60);
            if (hoursTill < 0) {
                const embed = new EmbedBuilder({
                    title: `Season ${match.season} ${tier[0].toUpperCase() + tier.substring(1).toLowerCase()} | Regular Season Match`,
                    description: `[Match Page](https://vdc.gg/match/${match.matchID})`,
                    color: COLORS[match.tier],
                    fields: [
                        { name: `Teams`, value: `<${match.Home.Franchise.Brand.discordEmote}> **${match.Home.name}**\n<${match.Away.Franchise.Brand.discordEmote}> **${match.Away.name}**`, inline: true },
                        { name: `Result`, value: `**__${match.Games.filter(g => g.winner == match.Home.id).length}__**\n**__${match.Games.filter(g => g.winner == match.Away.id).length}__**`, inline: true },
                    ]
                })
                await interaction.channel.send({ embeds: [embed] })
                continue;
            };

            // initialize matchday counters and create select menu options for home and away teams
            let hi = 1;
            let ai = 1;
            const homeOptionsArr = homePlayed.map((m) => {
                const map1 = m.Games[0];
                const map2 = m.Games[1];

                const label = [
                    `Match Day ${hi}`,
                    `${m.Home.Franchise.slug} v. ${m.Away.Franchise.slug}`,
                    `${map1.map} : ${map1.roundsWonHome}-${map1.roundsWonAway}, ${map2.map} : ${map2.roundsWonHome}-${map2.roundsWonAway}`
                ].filter(v => v != null).join(` | `);
                hi++;
                return { label: label, value: String(m.matchID), emoji: home.Franchise.Brand.discordEmote };
            });
            const awayOptionsArr = awayPlayed.map((m) => {
                const map1 = m.Games[0];
                const map2 = m.Games[1];

                const label = [
                    `Match Day ${ai}`,
                    `${m.Home.Franchise.slug} v. ${m.Away.Franchise.slug}`,
                    `${map1.map} : ${map1.roundsWonHome}-${map1.roundsWonAway}, ${map2.map} : ${map2.roundsWonHome}-${map2.roundsWonAway}`
                ].filter(v => v != null).join(` | `);
                ai++;
                return { label: label, value: String(m.matchID), emoji: away.Franchise.Brand.discordEmote }
            });

            const messageObject = {
                poll: {
                    question: { text: `${tier.charAt(0).toUpperCase() + tier.substring(1).toLowerCase()} Match Day ${day} Predictions : ${match.Home.Franchise.slug} v. ${match.Away.Franchise.slug}` },
                    answers: [
                        { text: `2 - 0`, emoji: match.Home.Franchise.Brand.discordEmote },
                        { text: `1 - 1`, emoji: `🟰` },
                        { text: `2 - 0`, emoji: match.Away.Franchise.Brand.discordEmote },
                    ],
                    allowMultiselect: false,
                    duration: hoursTill,
                    components: []
                }
            };

            if (homeOptionsArr.length !== 0) {
                // create the action row, add the component to it & then reply with all the data
                const homeRow = new ActionRowBuilder({
                    components: [new StringSelectMenuBuilder({
                        customId: `maphistory_home`,
                        placeholder: `${home.Franchise.name} Match History`,
                        options: homeOptionsArr,
                    })]
                });
                messageObject.components.push(homeRow);
            }

            if (awayOptionsArr.length !== 0) {
                // create the action row, add the component to it & then reply with all the data
                const awayRow = new ActionRowBuilder({
                    components: [new StringSelectMenuBuilder({
                        customId: `maphistory_away`,
                        placeholder: `${away.Franchise.name} Match History`,
                        options: awayOptionsArr,
                    })]
                });
                messageObject.components.push(awayRow);
            }

            // send the match poll predictions
            await interaction.channel.send(messageObject)
        }

        logger.log(`INFO`, `Sent \`${tier}\` prediction polls in ${interaction.channel}`);
        return await interaction.editReply(`The polls for match day ${day} have been sent!`);
    }
};
