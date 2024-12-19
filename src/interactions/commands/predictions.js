const { ChatInputCommandInteraction, Poll, PollLayoutType, ActionRowBuilder, StringSelectMenuBuilder } = require(`discord.js`);

const { updateFranchiseManagement, refreshFranchisesChannel } = require(`../subcommands/league`);
const { CHANNELS } = require("../../../utils/enums");
const { prisma } = require("../../../prisma/prismadb");
const { MatchType } = require("@prisma/client");


module.exports = {

    name: `predictions`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply({ ephemeral: true });

        const options = interaction.options._hoistedOptions;
        const tier = options.find(o => o.name == `tier`).value;
        const day = Number(options.find(o => o.name == `matchday`).value);

        const matches = await prisma.matches.findMany({
            where: {
                tier: tier,
                matchDay: day
            },
            include: {
                Home: { include: { Franchise: { include: { Brand: true } } } },
                Away: { include: { Franchise: { include: { Brand: true } } } },
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
                    season: 7,
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
                    season: 7,
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
            if (hoursTill < 0) return await interaction.editReply(`This matchday has already happened!`);

            // initialize matchday counters and create select menu options for home and away teams
            let hi = 1;
            let ai = 1;
            const homeOptionsArr = homePlayed.map((m) => {
                const map1 = m.Games[0];
                const map2 = m.Games[1];

                const label = [
                    `Match Day ${hi}`,
                    `${m.Home.Franchise.slug} v. ${m.Away.Franchise.slug}`,
                    map1.map,
                    `${map1.roundsWonHome}-${map1.roundsWonAway}, ${map2.roundsWonHome}-${map2.roundsWonAway}`
                ].filter(v => v != null).join(` | `);
                hi++;
                return { label: label, value: map1.gameID, emoji: home.Franchise.Brand.discordEmote };
            });
            const awayOptionsArr = awayPlayed.map((m) => {
                const map1 = m.Games[0];
                const map2 = m.Games[1];

                const label = [
                    `Match Day ${ai}`,
                    `${m.Home.Franchise.slug} v. ${m.Away.Franchise.slug}`,
                    map1.map,
                    `${map1.roundsWonHome}-${map1.roundsWonAway}, ${map2.roundsWonHome}-${map2.roundsWonAway}`
                ].filter(v => v != null).join(` | `);
                ai++;
                return { label: label, value: map1.gameID, emoji: away.Franchise.Brand.discordEmote }
            });

            // create the action row, add the component to it & then reply with all the data
            const homeRow = new ActionRowBuilder({
                components: [new StringSelectMenuBuilder({
                    customId: `maphistory_home`,
                    placeholder: `${home.Franchise.name} Match History`,
                    options: homeOptionsArr,
                })]
            });
            const awayRow = new ActionRowBuilder({
                components: [new StringSelectMenuBuilder({
                    customId: `maphistory_away`,
                    placeholder: `${away.Franchise.name} Match History`,
                    options: awayOptionsArr,
                })]
            });

            // send the match poll predictions
            await interaction.channel.send({
                poll: {
                    question: { text: `${tier.charAt(0).toUpperCase() + tier.substring(1).toLowerCase()} Match Day ${day} Predictions : ${match.Home.Franchise.slug} v. ${match.Away.Franchise.slug}` },
                    answers: [
                        { text: `2 - 0`, emoji: match.Home.Franchise.Brand.discordEmote },
                        { text: `1 - 1`, emoji: `🟰` },
                        { text: `2 - 0`, emoji: match.Away.Franchise.Brand.discordEmote },
                    ],
                    allowMultiselect: false,
                    duration: hoursTill,
                },
                components: [homeRow, awayRow]
            })

        }

        return await interaction.editReply(`The polls for match day ${day} have been sent!`);
    }
};
