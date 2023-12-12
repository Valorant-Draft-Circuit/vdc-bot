const { ChatInputCommandInteraction, GuildMember, EmbedBuilder } = require("discord.js");

const { Games, Team, Player } = require("../../prisma");
const { AgentEmotes } = require("../../utils/enums");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();


const sum = (array) => array.reduce((s, v) => s += v == null ? 0 : v, 0);
const avg = (array) => array.reduce((s, v) => s += v, 0) / array.length;

module.exports = {

    name: `stats`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply();

        const { _subcommand, _hoistedOptions } = interaction.options;
        switch (_subcommand) {
            case `match`:
                const matchURL = _hoistedOptions[0].value;
                return await sendMatchStats(interaction, matchURL);
            case `player`:
                const guildMember = _hoistedOptions[0].member;
                return await sendPlayerStats(interaction, guildMember);

            default:
                return await interaction.editReply({ content: `This is a work in progress!` })
        }

    }
};


// MAIN FUNCTIONS
// ################################################################################################
// ################################################################################################

async function sendMatchStats(/** @type ChatInputCommandInteraction */ interaction, matchURL) {
    const id = matchURL.replace(`https://tracker.gg/valorant/match/`, ``);

    // checks
    const exists = await Games.exists({ id: id });
    if (!exists) return interaction.editReply({ content: `Looks like this match doesn't exist in out database!` });
    const game = await Games.getMatchData({ id: id });
    if (!game.type.includes(`Season`)) return await interaction.editReply({ content: `You can only get match stats for a season game!` });

    // get teams
    const team1 = await Team.getBy({ id: game.team1 });
    const team2 = await Team.getBy({ id: game.team2 });

    // create outputs
    const roundsWonBar = createRoundsWonBar((({ PlayerStats, ...o }) => o)(game));
    const dataOutput = game.PlayerStats.map(p => createMatchPlayerStats(p, game.team1, p.Player.team));
    const date = new Date(game.date_played).toLocaleString("en-US", { dateZone: `CST`, month: `short`, day: `2-digit` });

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `${team1.tier} - ${team1.name} vs. ${team2.name} - ${date}`, url: matchURL },
        description: `${roundsWonBar}\n${dataOutput.join(`\n`)}`,
        color: 0xE92929,
        footer: { text: `Stats — Match` }
    });

    return await interaction.editReply({ embeds: [embed] })
}

async function sendPlayerStats(/** @type ChatInputCommandInteraction */ interaction, /** @type GuildMember */ guildMember) {

    const allStats = await prisma.playerStats.findMany({ include: {Player:{include: {Team:true}}}});
    const prospect = (allStats.filter(as=> as.Player?.Team?.tier == `Prospect`).map(as=>as.total_kills))/allStats.length
    console.log(`AVG KILLS` + prospect)






    const did = `283614189178585099`;
    const player = await Player.getBy({ discordID: did /** guildMember.user.id */ });
    const team = await Team.getBy({ playerID: did });
    const playerStats = (await Player.getStatsBy({ discordID: did /** guildMember.user.id */ }))
        .map(s => {
            const rounds = Math.round(s.total_kills / s.pr_kills);
            return { ...s, rounds: rounds, total_damage: rounds * s.pr_damage }
        }).filter(g => g.Games.winner !== null); // calculate rounds
    console.log(playerStats[0])

    const totalGames = playerStats.length;
    console.log(totalGames)
    const summedStats = {
        total_kills: sum(playerStats.map(ps => ps.total_kills)),
        total_assists: sum(playerStats.map(ps => ps.total_assists)),
        total_deaths: sum(playerStats.map(ps => ps.total_deaths)),
        total_first_kills: sum(playerStats.map(ps => ps.total_first_kills)),
        total_first_deaths: sum(playerStats.map(ps => ps.total_first_deaths)),
        total_damage: sum(playerStats.map(ps => ps.total_damage)),
        rounds: sum(playerStats.map(ps => ps.rounds)),
        avgkast: avg(playerStats.map(ps => ps.kast)),
        avgwin: playerStats.map(ps => ps.Games.winner).filter(ps => ps === team?.id)/totalGames
    }

    console.log(summedStats)

    const kpr = (summedStats.total_kills / summedStats.rounds).toFixed(2);
    const apr = (summedStats.total_assists / summedStats.rounds).toFixed(2);
    const dpr = (summedStats.total_deaths / summedStats.rounds).toFixed(2);
    const dmgpr = (summedStats.total_damage / summedStats.rounds).toFixed(2);
    const fkpr = (summedStats.total_first_kills / summedStats.rounds).toFixed(2);
    const fdpr = (summedStats.total_first_deaths / summedStats.rounds).toFixed(2);
    const avgkast = (summedStats.avgkast).toFixed(2);

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: player.Account.riotID },
        description: `stuff`,
        color: 0xE92929,
        fields: [
            { name: `K/R`, value: `\`\`\`ansi\n\u001b[0;36m${kpr}\`\`\``, inline: true },
            { name: `D/R`, value: `\`\`\`ansi\n\u001b[0;36m${dpr}\`\`\``, inline: true },
            { name: `A/R`, value: `\`\`\`ansi\n\u001b[0;36m${apr}\`\`\``, inline: true },
            { name: `FK/R`, value: `\`\`\`ansi\n\u001b[0;36m${fkpr}\`\`\``, inline: true },
            { name: `FD/R`, value: `\`\`\`ansi\n\u001b[0;36m${fdpr}\`\`\``, inline: true },
            { name: `Average KAST`, value: `\`\`\`ansi\n\u001b[0;36m${avgkast}\`\`\``, inline: true },

        ],
        footer: { text: `Stats — Player` }
    });
    return await interaction.editReply({ embeds: [embed] })
}

// HELPER FUNCTIONS
// ################################################################################################
// ################################################################################################

/** Dynamically create the bar for rounds won by each team */
function createRoundsWonBar(match) {
    const totalRounds = match.rounds_played;
    const t1RoundPercent = (match.rounds_won_t1 / totalRounds);

    const barlen = 44;
    const filled = `■`;

    const filledBoxes = Math.floor((t1RoundPercent) * barlen)
    const t1bar = `\u001b[0;31m${String(match.rounds_won_t1).padEnd(3, ` `)}` + ``.padStart(filledBoxes, filled);
    const t2bar = `\u001b[0;34m` + ``.padStart(barlen - filledBoxes, filled) + `${String(match.rounds_won_t2).padStart(3, ` `)}`;

    // return the bar with correct color formatting
    return `\`\`\`ansi\n${t1bar + t2bar}\n\`\`\``;
}

/** Create the stats "module" for a player */
function createMatchPlayerStats(player, team1, team) {
    // collect & organize data for outputs
    const trackerLink = `[${player.Player.Account.riotID.split(`#`)[0]}](https://tracker.gg/valorant/profile/riot/${encodeURIComponent(player.Player.Account.riotID)})`
    const color = team === null ? `[0;30m` : team === team1 ? `[0;31m` : `[0;34m`; // gray > red > blue
    const agentSatatized = player.agent.toLowerCase().replace(/[^a-z]/, ``);
    const agentEmote = `<:${agentSatatized}:${AgentEmotes[agentSatatized]}>`;
    const teamName = player.Player.Team ? player.Player.Team.name : `Substitute`;
    const rating = `ATK : \`${player.rating_atk}\` / DEF : \`${player.rating_def}\``;

    // create table headers
    const headings = [
        `K/D`.padStart(5, ` `),
        `K`.padStart(3, ` `),
        `D`.padStart(3, ` `),
        `A`.padStart(3, ` `),
        `HS% `.padStart(6, ` `),
        `ACS`.padStart(4, ` `),
        `KAST`.padStart(5, ` `),
        `FK`.padStart(3, ` `),
        `FD`.padStart(3, ` `),
    ];

    // store table data
    const data = [
        (player.total_kills / player.total_deaths).toFixed(2).padStart(5, ` `),
        String(player.total_kills).padStart(3, ` `),
        String(player.total_deaths).padStart(3, ` `),
        String(player.total_assists).padStart(3, ` `),
        player.hs_percent.toFixed(2).padStart(6, ` `),
        String(player.acs).padStart(4, ` `),
        String(player.kast).padStart(5, ` `),
        String(player.total_first_kills).padStart(3, ` `),
        String(player.total_first_deaths).padStart(3, ` `),
    ];

    // return a stats "module" for the specified player
    return `${agentEmote} ${trackerLink} | ${rating} | ${teamName}` + `\n` +
        `\`\`\`ansi\n\u001b${color}${headings.join(` |`)}\n${data.join(` |`)} \`\`\``;
}

// ################################################################################################
// ################################################################################################
