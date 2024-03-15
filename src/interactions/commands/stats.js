const { ChatInputCommandInteraction, GuildMember, EmbedBuilder } = require("discord.js");

const { Games, Team, Player } = require("../../../prisma");
const { AgentEmotes, PlayerStatusCode } = require("../../../utils/enums");

const sum = (array) => array.reduce((s, v) => s += v == null ? 0 : v, 0);
const avg = (array) => array.reduce((s, v) => s += v, 0) / array.length;

const tiercaps = {
    prospect: 93,
    apprentice: 118,
    expert: 160,
    mythic: 999,
}; // max MMR for these tiers (mythic has no max MMR)

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

    const player = await Player.getBy({ discordID: guildMember.user.id });
    const playerStats = await Player.getStatsBy({ discordID: guildMember.user.id });

    const mmr = player.MMR_Player_MMRToMMR.mmr_overall;
    const team = player.Team;
    const processedPlayerStats = playerStats.map(s => {
        const rounds = Math.round(s.total_kills / s.pr_kills);
        return { ...s, rounds: rounds, total_damage: rounds * s.pr_damage }
    });

    // get agent pool & save as emotes
    const agentPool = [...new Set(processedPlayerStats.map(ps => ps.agent))].map(agent => {
        const agentSatatized = agent.toLowerCase().replace(/[^a-z]/, ``);
        return `<:${agentSatatized}:${AgentEmotes[agentSatatized]}>`
    });

    // create the code block module (Team stats if on a team, Sub info if sub)
    const associatedData = team ? await createFranchiseStatsModule(player) : await createSubOverview(player);

    const summedStats = {
        total_kills: sum(processedPlayerStats.map(ps => ps.total_kills)),
        total_assists: sum(processedPlayerStats.map(ps => ps.total_assists)),
        total_deaths: sum(processedPlayerStats.map(ps => ps.total_deaths)),
        total_first_kills: sum(processedPlayerStats.map(ps => ps.total_first_kills)),
        total_first_deaths: sum(processedPlayerStats.map(ps => ps.total_first_deaths)),
        total_damage: sum(processedPlayerStats.map(ps => ps.total_damage)),
        rounds: sum(processedPlayerStats.map(ps => ps.rounds)),
        avgkast: avg(processedPlayerStats.map(ps => ps.kast)),
        total_plants: sum(processedPlayerStats.map(ps => ps.total_plants)),
        total_plants: sum(processedPlayerStats.map(ps => ps.total_plants)),
        total_clutches: sum(processedPlayerStats.map(ps => ps.total_clutches)),
        rating_atk: avg(processedPlayerStats.map(ps => ps.rating_atk)),
        rating_def: avg(processedPlayerStats.map(ps => ps.rating_def)),
    }

    // do calculations and formatting
    const rating_atk = summedStats.rating_atk.toFixed(2)
    const rating_def = summedStats.rating_def.toFixed(2)
    const kpr = (summedStats.total_kills / summedStats.rounds).toFixed(2);
    const apr = (summedStats.total_assists / summedStats.rounds).toFixed(2);
    const dpr = (summedStats.total_deaths / summedStats.rounds).toFixed(2);
    const dmgpr = (summedStats.total_damage / summedStats.rounds).toFixed(2);
    const fkpr = (summedStats.total_first_kills * 100 / summedStats.rounds).toFixed(2);
    const fdpr = (summedStats.total_first_deaths * 100 / summedStats.rounds).toFixed(2);
    const plants = summedStats.total_plants;
    const clutches = summedStats.total_clutches;
    const avgkast = (summedStats.avgkast).toFixed(2);

    const riotID = player.Account.riotID;
    const trackerURL = `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(riotID)}`

    // prefix for user
    const prefix = player.Team?.Franchise ? player.Team.Franchise.slug : player.status == PlayerStatusCode.FREE_AGENT ? `FA` : `RFA`;

    const description = [
        `ATK : \` ${rating_atk} \` // DEF : \` ${rating_def} \``,
        [
            `MMR: \` ${String(mmr).padStart(3, ` `)} \``,
            `Games: \` ${String(processedPlayerStats.length).padStart(3, ` `)} \``,
            agentPool.join(` `)
        ].join(` | `),
        associatedData
    ];

    // create the embed
    const embed = new EmbedBuilder({
        author: { name: [prefix, riotID.split(`#`)[0]].join(` | `), url: trackerURL },
        description: description.join(`\n`),
        color: 0xE92929,
        fields: [
            { name: `Kills/Round`, value: `\`\`\`ansi\n\u001b[0;36m${kpr}\`\`\``, inline: true },
            { name: `Damage/Round`, value: `\`\`\`ansi\n\u001b[0;36m${dmgpr}\`\`\``, inline: true },
            { name: `Assists/Round`, value: `\`\`\`ansi\n\u001b[0;36m${apr}\`\`\``, inline: true },
            { name: `First Kill %`, value: `\`\`\`ansi\n\u001b[0;36m${fkpr} %\`\`\``, inline: true },
            { name: `KAST`, value: `\`\`\`ansi\n\u001b[0;36m${avgkast} %\`\`\``, inline: true },
            { name: `Clutches`, value: `\`\`\`ansi\n\u001b[0;36m${clutches}\`\`\``, inline: true },
            { name: `First Death %`, value: `\`\`\`ansi\n\u001b[0;36m${fdpr} %\`\`\``, inline: true },
            { name: `Deaths/Round`, value: `\`\`\`ansi\n\u001b[0;36m${dpr}\`\`\``, inline: true },
            { name: `Plants`, value: `\`\`\`ansi\n\u001b[0;36m${plants}\`\`\``, inline: true },

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
        `\`\`\`ansi\n\u001b${color}${headings.join(` |`)}\n${data.join(` |`)}\`\`\``;
}

/** Create the standings "module" for a franchise if the player is signed to one */
async function createFranchiseStatsModule(player) {
    const team = player.Team;
    const franchise = team.Franchise;

    const emote = `<${franchise.emoteID}>`;
    const slug = franchise.slug;
    const franchiseName = franchise.name;
    const teamName = team.name;

    const allTeamGames = await Games.getAllBy({ team: team.id });
    const teamStats = {
        wins: allTeamGames.filter(atg => atg.winner === team.id).length,
        loss: allTeamGames.filter(atg => atg.winner !== team.id).length,
        roundsWon: sum(allTeamGames.map(atg => atg.team1 === team.id ? atg.rounds_won_t1 : atg.rounds_won_t2)),
        totalRounds: sum(allTeamGames.map(atg => atg.rounds_played))
    }


    // text coloring
    const color = `\u001b[0;30m`;
    const GREEN = `\u001b[0;32m`;
    const RED = `\u001b[0;31m`;

    // centering for team names
    const teamMaxWidth = 20;
    const teamNameLength = teamName.length;
    const startSpaces = Math.ceil((teamMaxWidth - teamNameLength) / 2);

    // create the data array
    const data = [
        // ` # ${teamGameData.rank}`.padEnd(5, ` `),
        (slug.length < 3 ? `${slug} ` : slug).padStart(4, ` `),
        teamName.padStart(teamNameLength + startSpaces, ` `).padEnd(teamMaxWidth, ` `),
        GREEN + String(teamStats.wins).padStart(2, ` `),
        RED + String(teamStats.loss).padStart(2, ` `),
        color + `${(100 * teamStats.roundsWon / teamStats.totalRounds).toFixed(2)}% `.padStart(6, ` `),
    ];

    // and then format & return the "module"
    return `\n${emote} **${franchiseName}** - ${team.tier}` + `\n` +
        `\`\`\`ansi\n${color}${data.join(`${color} | `)}\n\`\`\``;
}

/** Create the overview "module" for a sub if the player not on a team */
async function createSubOverview(player) {
    /** @todo When we have extra sub data, we can return sub stats here */

    const subtype = player.status === PlayerStatusCode.FREE_AGENT ? `Free Agent` : `Restricted Free Agent`;
    let tier;
    if (player.MMR_Player_MMRToMMR.mmr_overall < tiercaps.prospect) tier = `Prospect`;
    else if (player.MMR_Player_MMRToMMR.mmr_overall < tiercaps.apprentice) tier = `Apprentice`;
    else if (player.MMR_Player_MMRToMMR.mmr_overall < tiercaps.expert) tier = `Expert`;
    else tier = `Mythic`;

    const string = `Substitute - ${subtype} - ${tier}`;
    const barlen = 45;
    const padStart = Math.ceil((barlen - string.length) / 2) + string.length;

    return `\n\`\`\`ansi\n\u001b[0;30m ${string.padStart(padStart, ` `).padEnd(barlen, ` `)} \n\`\`\``;
}

// ################################################################################################
// ################################################################################################
