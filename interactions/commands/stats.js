const { ChatInputCommandInteraction, EmbedBuilder } = require("discord.js");

const { ButtonStyle } = require(`discord.js`)

const { TransactionsSubTypes, TransactionsCutOptions } = require(`../../utils/enums/transactions`);
// const { FranchiseEmote } = require(`../../utils/enums/franchiseEmotes`);
// const { getPlayerStatsByDiscordId } = require(`../../prisma`)
const franchises = require(`../../cache/franchises.json`);
const DiscordAssets = require(`../../utils/functions/discordAssets`);
const { Games, Team } = require("../../prisma");
const { AgentEmotes } = require("../../utils/enums");


module.exports = {
    //https://cdn.discordapp.com/avatars/173237627955314689/d643c62aed33ec505c3e5fb2f1806c17.jpg

    name: `stats`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply();

        const { _subcommand, _hoistedOptions } = interaction.options;
        switch (_subcommand) {
            case `match`:
                const matchURL = _hoistedOptions[0].value;
                return await sendMatchStats(interaction, matchURL)

            default:
                return await interaction.editReply({ content: `This is a work in progress!` })
        }

    }
};

async function sendMatchStats(interaction, matchURL) {
    const id = matchURL.replace(`https://tracker.gg/valorant/match/`, ``)
    const game = await Games.getMatchData({ id: id });

    const matchOut = createMatchStatsOut((({ PlayerStats, ...o }) => o)(game));

    const date = new Date(game.date_played).toLocaleString("en-US", { dateZone: `CST`, month: `short`, day: `2-digit` });

    console.log(game.PlayerStats[0])

    const team1 = await Team.getBy({ id: game.team1 });
    const team2 = await Team.getBy({ id: game.team2 });

    const out = game.PlayerStats.map(p => createPlayerStatsOut(p, game.team1, p.Player.team))

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `${team1.tier} - ${team1.name} vs. ${team2.name} - ${date}`, url: matchURL },
        description: `${matchOut}\n${out.join(`\n`)}`,
        color: 0xE92929,
        footer: { text: `Stats — Match` }
    });

    await interaction.editReply({ embeds: [embed] })
}


function createMatchStatsOut(match) {
    // console.log(match)
    const totalRounds = match.rounds_played;
    const t1RoundPercent = (match.rounds_won_t1 / totalRounds) * 100;

    const barlen = 44;
    const filled = `■`;

    const filledBoxes = Math.floor((t1RoundPercent / 100) * barlen)
    const t1bar = `\u001b[0;31m${String(match.rounds_won_t1).padEnd(3, ` `)}` + ``.padStart(filledBoxes, filled);
    const t2bar = `\u001b[0;34m` + ``.padStart(barlen - filledBoxes, filled) + `${String(match.rounds_won_t2).padStart(3, ` `)}`;

    return `\`\`\`ansi\n${t1bar + t2bar}\n\`\`\``;
}

function createPlayerStatsOut(player, team1, team) {

    const trackerLink = `[${player.Player.Account.riotID.split(`#`)[0]}](https://tracker.gg/valorant/profile/riot/${encodeURIComponent(player.Player.Account.riotID)})`
    const color = team === null ? `[0;30m` : team === team1 ? `[0;31m` : `[0;34m`;
    const agentEmote = `<:${player.agent.toLowerCase()}:${AgentEmotes[player.agent.toLowerCase()]}>`;
    const teamName = player.Player.Team ? player.Player.Team.name : `Substitute`;
    const rating = `ATK : \`${player.rating_atk}\` / DEF : \`${player.rating_def}\``;

    const headings = [
        `K/D`.padStart(4, ` `),
        `K`.padStart(3, ` `),
        `D`.padStart(3, ` `),
        `A`.padStart(3, ` `),
        `HS% `.padStart(6, ` `),
        `ACS`.padStart(4, ` `),
        `KAST`.padStart(5, ` `),
        `FK`.padStart(3, ` `),
        `FD`.padStart(3, ` `),
        // `P`.padStart(3, ` `),
        // `D`.padStart(3, ` `),
    ];

    const data = [
        (player.total_kills / player.total_deaths).toFixed(2).padStart(4, ` `),
        String(player.total_kills).padStart(3, ` `),
        String(player.total_deaths).padStart(3, ` `),
        String(player.total_assists).padStart(3, ` `),
        player.hs_percent.toFixed(2).padStart(6, ` `),
        String(player.acs).padStart(4, ` `),
        String(player.kast).padStart(5, ` `),
        String(player.total_first_kills).padStart(3, ` `),
        String(player.total_first_deaths).padStart(3, ` `),
        // String(player.total_plants).padStart(3, ` `),
        // String(player.total_defuses).padStart(3, ` `),
    ];

    return `${agentEmote} ${trackerLink} | ${rating} | ${teamName}\n\`\`\`ansi\n\u001b${color}${headings.join(` |`)}\n${data.join(` |`)}\`\`\``;
}






function getAverage(arr) {
    return arr.reduce((s, v) => s += v, 0) / arr.length;
}