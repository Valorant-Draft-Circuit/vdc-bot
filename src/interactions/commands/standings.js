const { EmbedBuilder, ChatInputCommandInteraction } = require("discord.js");
const { Games, Team, ControlPanel } = require("../../../prisma");
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

    name: `standings`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply();

        const options = interaction.options._hoistedOptions;

        const tier = options[0].value;
        const currentSeason = await ControlPanel.getSeason()
        const season = options[1] ? options[1].value : currentSeason;
        if (season > currentSeason) return await interaction.editReply(`Season ${season} hasn't happened yet!`);
        if (season < 6) return await interaction.editReply(`We don't have standings saved for seasons prior to season 6 :(`);

        // get all valid SEASON games for the requested tier and season
        const games = await Games.getAllBy({ type: [GameType.SEASON, GameType.FORFEIT], tier: tier, season: season });

        // create array of unique teamIDs
        const activeTeamIDs = Array.from(new Set(games.map(ag => {
            return [ag.Match.home, ag.Match.away]
        }).flat()));

        // create a teams filter to get teams who were active in that season
        const teamsFilter = activeTeamIDs.map(atid => { return { id: atid } });
        const teams = season == currentSeason ?
            await Team.getAllActiveByTier(tier) :
            await prisma.teams.findMany({
                where: {
                    AND: [
                        { OR: teamsFilter },
                        { tier: tier },
                    ]
                },
                include: { Franchise: { include: { Brand: true } } }
            });

        // Get wins, losses, round wins & losses, total rounds and then first sort bt RWP and then total wins to correctly order the standings
        const processedData = teams.map(team => {
            const gamesPlayed = games.filter(g => [g.Match.home, g.Match.away].includes(team.id));
            const totalGamesPlayed = gamesPlayed.length;
            const gamesWon = games.filter(g => g.winner == team.id).length;
            const gamesLost = totalGamesPlayed - gamesWon;

            const roundsWon = gamesPlayed.map(g => g.Match.home === team.id ? g.roundsWonHome : g.roundsWonAway);
            const roundsLost = gamesPlayed.map(g => g.rounds - (g.Match.home === team.id ? g.roundsWonHome : g.roundsWonAway));
            const totalRounds = gamesPlayed.map(g => g.rounds);

            team.wins = gamesWon;
            team.loss = gamesLost;
            team.roundsWon = sum(roundsWon);
            team.roundsLost = sum(roundsLost);
            team.totalRounds = sum(totalRounds);

            return team;
        }).sort((a, b) => (b.roundsWon / b.totalRounds) - (a.roundsWon / a.totalRounds)).sort((a, b) => b.wins - a.wins);

        // once each team is sorted, add their rank
        let rank = 1;
        processedData.forEach(d => { d.rank = rank; rank++; })

        // create the legend
        const legend = [
            `  #`.padEnd(5, ` `),
            `Team`.padStart(13, ` `).padEnd(27, ` `),
            `W`.padStart(2, ` `),
            `L`.padStart(2, ` `),
            `RW %`.padStart(6, ` `),
        ];

        // convert the data to output format for embed
        const standingsOutput = processedData.map(data => createFranchiseStandingsModule(data));

        // create the base embed
        const embed = new EmbedBuilder({
            author: { name: `${tier[0].toUpperCase() + tier.substring(1).toLowerCase()} | Season ${season} Franchise Standings`, iconURL: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/vdc-logos/champwall.png` },
            description: `\`\`\`${legend.join(`   `)}\`\`\`\n${standingsOutput.join(`\n`)}`,
            color: COLORS[tier],
            footer: { text: `Standings — ${tier[0].toUpperCase() + tier.substring(1).toLowerCase()}` }
        });

        return await interaction.editReply({ embeds: [embed] });
    }
};

/** Create the standings "module" for a franchise */
function createFranchiseStandingsModule(teamData) {
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
        color + `${((100 * teamData.roundsWon / teamData.totalRounds) || 0).toFixed(2)}%`.padStart(6, ` `),
    ]

    // and then format & return the "module"
    return `${emote} **${franchiseName}**` + `\n` +
        `\`\`\`ansi\n${color}${data.join(`${color} | `)} \`\`\``;
}
