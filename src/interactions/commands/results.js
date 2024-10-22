const { EmbedBuilder, ChatInputCommandInteraction } = require("discord.js");
const { Games, Team } = require("../../../prisma");
const { GameType } = require("@prisma/client");
const { prisma } = require("../../../prisma/prismadb");

const sum = (array) => array.reduce((s, v) => s += v == null ? 0 : v, 0);
const playoffsCutoff = {
    prospect: 4,
    apprentice: 6,
    expert: 6,
    mythic: 4
};

const COLORS = {
    PROSPECT: 0xFEC335,
    APPRENTICE: 0x72C357,
    EXPERT: 0x04AEE4,
    MYTHIC: 0xA657A6,
}

module.exports = {

    name: `results`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply();

        const tier = interaction.options._hoistedOptions[0].value;
        const day = interaction.options._hoistedOptions[1].value;


        const dbmatches = await prisma.matches.findMany({
            where: { tier: tier, matchType: `BO2` },
            include: {
                Home: { include: { Franchise: { include: { Brand: true } } } },
                Away: { include: { Franchise: { include: { Brand: true } } } },
                Games: true
            }
        });

        console.log(dbmatches.length)


        const sortedMatches = [[]];

        /** @TODO you know the number of matches in a match day (teams/2), change this */
        let date = String(dbmatches[0].dateScheduled);
        let matchDay = 0; // incrementor for match day
        for (let i = 0; i < dbmatches.length; i++) {

            if (String(dbmatches[i].dateScheduled) == date) {
                sortedMatches[matchDay].push(dbmatches[i]);
            } else {
                sortedMatches[matchDay + 1] = [dbmatches[i]];
                date = String(dbmatches[i].dateScheduled)
                matchDay++;
            }

        };

        const rmd = sortedMatches[day - 1]; // rmd = requested match day


        const homeTeams = rmd.map(m => m.Home);
        const awayTeams = rmd.map(m => m.Away);

        const score = rmd.map(m => {
            const h = m.home;
            let score;
            if (m.Games.length == 0) score = `vs`
            else if (m.Games[0].winner == h && m.Games[1].winner == h) score = `2-0`;
            else if (m.Games[0].winner != m.Games[1].winner) score = `1-1`;
            else score = `0-2`
            return score
        })



        console.log(sortedMatches[day - 1])
        const embed = new EmbedBuilder({
            title: `results`,
            color: COLORS[tier],
            fields: [
                { name: `Home`, value: homeTeams.map(t => t.name).join(`\n`), inline: true },
                { name: `\u200B`, value: score.join(`\n`), inline: true },
                { name: `Away`, value: awayTeams.map(t => t.name).join(`\n`), inline: true }
            ]
        });

        return await interaction.editReply({ embeds: [embed] });
    }
};

/** Create the standings "module" for a franchise */
function createFranchiseStandingsModule(teamData) {
    // console.log(teamData)
    // collect & organize data for outputs
    const emote = `<${teamData.Franchise.Brand.discordEmote}>`;
    const slug = teamData.Franchise.slug;
    const franchiseName = teamData.Franchise.name;
    const teamName = teamData.name;

    // text coloring
    const color = teamData.rank > playoffsCutoff[teamData.tier.toLowerCase()] ? `\u001b[0;30m` : `\u001b[0;37m`;
    const GREEN = `\u001b[0;32m`;
    const RED = `\u001b[0;31m`;

    // centering for team names
    const teamMaxWidth = 20;
    const teamNameLength = teamName.length;
    const startSpaces = Math.ceil((teamMaxWidth - teamNameLength) / 2);

    // create the data array
    const data = [
        ` # ${teamData.rank}`.padEnd(5, ` `),
        (slug.length < 3 ? `${slug} ` : slug).padStart(4, ` `),
        teamName.padStart(teamNameLength + startSpaces, ` `).padEnd(teamMaxWidth, ` `),
        GREEN + String(teamData.wins).padStart(2, ` `),
        RED + String(teamData.loss).padStart(2, ` `),
        color + `${(100 * teamData.roundsWon / teamData.totalRounds).toFixed(2)}%`.padStart(6, ` `),
    ]

    // and then format & return the "module"
    return `${emote} **${franchiseName}**` + `\n` +
        `\`\`\`ansi\n${color}${data.join(`${color} | `)} \`\`\``;
}
