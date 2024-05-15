const { ChatInputCommandInteraction, GuildMember, EmbedBuilder } = require("discord.js");

const { Games, Team, Player } = require("../../../prisma");
const { AgentEmotes, PlayerStatusCode } = require("../../../utils/enums");
const { GameType, LeagueStatus } = require("@prisma/client");

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
        // return interaction.reply({ content: `This isn't ready for season 6 yet!` });
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
    if (!exists) return interaction.editReply(`Looks like this match doesn't exist in out database!`);
    const game = await Games.getMatchData({ id: id });
    if (!game.gameType.includes(GameType.SEASON)) return await interaction.editReply(`You can only get match stats for a season game!`);

    // console.log(game)
    // get teams
    const home = await Team.getBy({ id: game.Match.home });
    const away = await Team.getBy({ id: game.Match.away });

    // create outputs
    const roundsWonBar = createRoundsWonBar((({ PlayerStats, ...o }) => o)(game));
    const dataOutput = game.PlayerStats.map(p => createMatchPlayerStats(p, game.Match.home, p.Player.team));
    const date = new Date(game.datePlayed).toLocaleString("en-US", { dateZone: `CST`, month: `short`, day: `2-digit` });

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `${home.tier} - ${home.name} vs. ${away.name} - ${date}`, url: matchURL },
        description: `${roundsWonBar}\n${dataOutput.join(`\n`)}`,
        color: 0xE92929,
        footer: { text: `Stats — Match` }
    });

    return await interaction.editReply({ embeds: [embed] })
}

async function sendPlayerStats(/** @type ChatInputCommandInteraction */ interaction, /** @type GuildMember */ guildMember) {

    const player = await Player.getBy({ discordID: guildMember.user.id });
    // console.log(player)
    const playerStats = await Player.getStatsBy(player.id);

    const mmr = Math.round(player.PrimaryRiotAccount.MMR.mmrEffective);
    const team = player.Team;
    const processedPlayerStats = playerStats.map(s => {
        console.log(s)
        const rounds = s.Game.rounds;
        return { ...s, rounds: rounds, totalDamage: s.damage }
    });

    // get agent pool & save as emotes
    const agentPool = [...new Set(processedPlayerStats.map(ps => ps.agent))].map(agent => {
        const agentSatatized = agent.toLowerCase().replace(/[^a-z]/, ``);
        return `<:${agentSatatized}:${AgentEmotes[agentSatatized]}>`
    });

    // create the code block module (Team stats if on a team, Sub info if sub)
    const associatedData = team ? await createFranchiseStatsModule(player) : await createSubOverview(player);

    const summedStats = {
        totalKills: sum(processedPlayerStats.map(ps => ps.kills)),
        totalAssists: sum(processedPlayerStats.map(ps => ps.assists)),
        totalDeaths: sum(processedPlayerStats.map(ps => ps.deaths)),
        firstKills: sum(processedPlayerStats.map(ps => ps.firstKills)),
        firstDeaths: sum(processedPlayerStats.map(ps => ps.firstDeaths)),
        totalDamage: sum(processedPlayerStats.map(ps => ps.totalDamage)),
        rounds: sum(processedPlayerStats.map(ps => ps.rounds)),
        avgkast: avg(processedPlayerStats.map(ps => ps.kast)),
        totalPlants: sum(processedPlayerStats.map(ps => ps.plants)),
        clutches: sum(processedPlayerStats.map(ps => ps.clutches)),
        ratingAttack: avg(processedPlayerStats.map(ps => ps.ratingAttack)),
        ratingDefense: avg(processedPlayerStats.map(ps => ps.ratingDefense)),
    }

    // do calculations and formatting
    const ratingAttack = summedStats.ratingAttack.toFixed(2)
    const ratingDefense = summedStats.ratingDefense.toFixed(2)
    const kpr = (summedStats.totalKills / summedStats.rounds).toFixed(2);
    const apr = (summedStats.totalAssists / summedStats.rounds).toFixed(2);
    const dpr = (summedStats.totalAssists / summedStats.rounds).toFixed(2);
    const dmgpr = (summedStats.totalDamage / summedStats.rounds).toFixed(2);
    const fkpr = (summedStats.firstKills * 100 / summedStats.rounds).toFixed(2);
    const fdpr = (summedStats.firstDeaths * 100 / summedStats.rounds).toFixed(2);
    const plants = summedStats.totalPlants;
    const clutches = summedStats.clutches;
    const avgkast = (summedStats.avgkast).toFixed(2);

    const riotIGN = player.PrimaryRiotAccount.riotIGN;
    const trackerURL = `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(riotIGN)}`

    // prefix for user
    const prefix = player.Team?.Franchise ? player.Team.Franchise.slug : player.Status == LeagueStatus.FREE_AGENT ? `FA` : `RFA`;

    const description = [
        `ATK : \` ${ratingAttack} \` // DEF : \` ${ratingDefense} \``,
        [
            `MMR: \` ${String(mmr).padStart(3, ` `)} \``,
            `Games: \` ${String(processedPlayerStats.length).padStart(3, ` `)} \``,
            agentPool.join(` `)
        ].join(` | `),
        associatedData
    ];

    // create the embed
    const embed = new EmbedBuilder({
        author: { name: [prefix, riotIGN.split(`#`)[0]].join(` | `), url: trackerURL },
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
    const totalRounds = match.rounds;
    const t1RoundPercent = (match.roundsWonHome / totalRounds);

    const barlen = 48;
    const filled = `█`;

    const filledBoxes = Math.floor((t1RoundPercent) * barlen)
    const t1bar = ` \u001b[0;31m${String(match.roundsWonHome).padEnd(3, ` `)}` + ``.padStart(filledBoxes, filled);
    const t2bar = `\u001b[0;34m` + ``.padStart(barlen - filledBoxes, filled) + `${String(match.roundsWonAway).padStart(3, ` `)} `;

    // return the bar with correct color formatting
    return `\`\`\`ansi\n${t1bar + t2bar}\n\`\`\``;
}

/** Create the stats "module" for a player */
function createMatchPlayerStats(player, home, team) {
    // console.log(team, home)

    const ign = player.Player.PrimaryRiotAccount.riotIGN;

    // collect & organize data for outputs
    const trackerLink = `[${ign.split(`#`)[0]}](https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ign)})`
    const color = team === null ? `[0;30m` : team === home ? `[0;31m` : `[0;34m`; // gray > red > blue
    const agentSatatized = player.agent.toLowerCase().replace(/[^a-z]/, ``);
    const agentEmote = `<:${agentSatatized}:${AgentEmotes[agentSatatized]}>`;
    const teamName = player.Player.Team ? player.Player.Team.name : `Substitute`;
    const rating = `ATK : \`${player.ratingAttack}\` / DEF : \`${player.ratingDefense}\``;

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
        (player.kills / player.deaths).toFixed(2).padStart(5, ` `),
        String(player.kills).padStart(3, ` `),
        String(player.deaths).padStart(3, ` `),
        String(player.assists).padStart(3, ` `),
        player.hsPercent.toFixed(2).padStart(6, ` `),
        String(player.acs).padStart(4, ` `),
        String(player.kast).padStart(5, ` `),
        String(player.firstKills).padStart(3, ` `),
        String(player.firstDeaths).padStart(3, ` `),
    ];

    // return a stats "module" for the specified player
    return `${agentEmote} ${trackerLink} | ${rating} | ${teamName}` + `\n` +
        `\`\`\`ansi\n\u001b${color}${headings.join(` |`)}\n${data.join(` |`)}\`\`\``;
}

/** Create the standings "module" for a franchise if the player is signed to one */
async function createFranchiseStatsModule(player) {
    const team = player.Team;
    const franchise = team.Franchise;

    const emote = `<${franchise.Brand.discordEmote}>`;
    const slug = franchise.slug;
    const franchiseName = franchise.name;
    const teamName = team.name;

    const allTeamGames = await Games.getAllBy({ team: team.id });
    console.log(allTeamGames)
    const teamStats = {
        wins: allTeamGames.filter(atg => atg.winner === team.id).length,
        loss: allTeamGames.filter(atg => atg.winner !== team.id).length,
        roundsWon: sum(allTeamGames.map(atg => atg.home === team.id ? atg.roundsWonHome : atg.roundsWonAway)),
        totalRounds: sum(allTeamGames.map(atg => atg.rounds))
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

    const subtype = player.Status.leagueStatus === LeagueStatus.FREE_AGENT ? `Free Agent` : `Restricted Free Agent`;
    let tier;
    if (player.PrimaryRiotAccount.MMR.mmrEffective < tiercaps.prospect) tier = `Prospect`;
    else if (player.PrimaryRiotAccount.MMR.mmrEffective < tiercaps.apprentice) tier = `Apprentice`;
    else if (player.PrimaryRiotAccount.MMR.mmrEffective < tiercaps.expert) tier = `Expert`;
    else tier = `Mythic`;

    const string = `Substitute - ${subtype} - ${tier}`;
    const barlen = 45;
    const padStart = Math.ceil((barlen - string.length) / 2) + string.length;

    return `\n\`\`\`ansi\n\u001b[0;30m ${string.padStart(padStart, ` `).padEnd(barlen, ` `)} \n\`\`\``;
}

// ################################################################################################
// ################################################################################################
