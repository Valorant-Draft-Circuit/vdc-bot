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
        // console.log(tier, day)

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

        // const playedMatches = (await prisma.matches.findMany({
        //     where: {
        //         OR: [
        //             { home: team.id },
        //             { away: team.id },
        //         ],
        //         season: 7,
        //         matchType: type,
        //     },
        //     include: {
        //         Games: true,
        //         Home: { include: { Franchise: true } },
        //         Away: { include: { Franchise: true } },
        //     },
        // })).filter(g => g.Games.length !== 0);

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            // if (i > 0) continue;
            // console.log((new Date(Date.parse(match.dateScheduled) + (4 * 60 * 60 * 1000))).toISOString())

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


            // console.log(homePlayed)
            // console.log(awayPlayed)


            const date = Date.parse(match.dateScheduled) - Date.now();
            const hoursTill = date / (1000 * 60 * 60);
            if (hoursTill < 0) return await interaction.editReply(`This matchday has already happened!`);

            // `[\`${match.Home.Franchise.slug} v. ${match.Away.Franchise.slug} | ${map} | ${game.roundsWonHome}-${game.roundsWonAway}\`](https://tracker.gg/valorant/match/${game.gameID})`

            let hi = 1;
            let ai = 1;
            const homeOptionsArr = homePlayed.map((m) => {
                const map1 = m.Games[0];
                const map2 = m.Games[1];

                const out1 = [
                    `Match Day ${hi}`,
                    `${m.Home.Franchise.slug} v. ${m.Away.Franchise.slug}`,
                    map1.map,
                    `${map1.roundsWonHome}-${map1.roundsWonAway}`
                ].filter(v => v != null).join(` | `);
                const out2 = [
                    `Match Day ${hi}`,
                    `${m.Home.Franchise.slug} v. ${m.Away.Franchise.slug}`,
                    map2.map,
                    `${map2.roundsWonHome}-${map2.roundsWonAway}`
                ].filter(v => v != null).join(` | `);
                hi++;
                // console.log(out1,out2)
                return [
                    { label: out1, value: map1.gameID, emoji: m.Home.Franchise.Brand.discordEmote },
                    { label: out2, value: map2.gameID, emoji: m.Home.Franchise.Brand.discordEmote }
                ]
            }).flat();
            const awayOptionsArr = awayPlayed.map((m) => {
                const map1 = m.Games[0];
                const map2 = m.Games[1];

                const out1 = [
                    `Match Day ${ai}`,
                    `${m.Home.Franchise.slug} v. ${m.Away.Franchise.slug}`,
                    map1.map,
                    `${map1.roundsWonHome}-${map1.roundsWonAway}`
                ].filter(v => v != null).join(` | `);
                const out2 = [
                    `Match Day ${ai}`,
                    `${m.Home.Franchise.slug} v. ${m.Away.Franchise.slug}`,
                    map2.map,
                    `${map2.roundsWonHome}-${map2.roundsWonAway}`
                ].filter(v => v != null).join(` | `);
                ai++;
                // console.log(out1,out2)
                return [
                    { label: out1, value: map1.gameID, emoji: m.Away.Franchise.Brand.discordEmote },
                    { label: out2, value: map2.gameID, emoji: m.Away.Franchise.Brand.discordEmote }
                ]
            }).flat();

            // create the action row, add the component to it & then reply with all the data
            const homeRow = new ActionRowBuilder({
                components: [new StringSelectMenuBuilder({
                    customId: `maphistory_home`,
                    placeholder: `${home.Franchise.name} Map History`,
                    options: homeOptionsArr,
                })]
            });
            const awayRow = new ActionRowBuilder({
                components: [new StringSelectMenuBuilder({
                    customId: `maphistory_away`,
                    placeholder: `${away.Franchise.name} Map History`,
                    options: awayOptionsArr,
                })]
            });




            // return
            await interaction.channel.send({
                poll: {
                    question: { text: `Match Day ${day} Predictions : ${match.Home.Franchise.slug} v. ${match.Away.Franchise.slug}` },
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









        // return await interaction.channel.send({
        //     poll: {
        //         question: { text: `team1 vs. team2` },
        //         answers: [
        //             { text: `team1 2-0`, emoji: `🔴` },
        //             { text: `1 1`, emoji: `🔴` },
        //             { text: `team2 2-0`, emoji: `🔴` },
        //         ],
        //         allowMultiselect: false,
        //         duration: 2,
        //     }
        // });
    }
};

function dhm(t) {
    let cd = 24 * 60 * 60 * 1000,
        ch = 60 * 60 * 1000,
        d = Math.floor(t / cd),
        h = Math.floor((t - d * cd) / ch),
        m = Math.round((t - d * cd - h * ch) / 60000),
        pad = function (n) { return n < 10 ? '0' + n : n; };
    if (m === 60) { h++; m = 0; }
    if (h === 24) { d++; h = 0; }
    return {
        d: d,
        h: h,
        m: m,
        readable: [d, pad(h), pad(m)].join(':')
    };
}
