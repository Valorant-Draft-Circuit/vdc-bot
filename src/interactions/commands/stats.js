const { ChatInputCommandInteraction, GuildMember, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require(`discord.js`);

const { Games, Team, Player, ControlPanel } = require(`../../../prisma`);
const { GameType, LeagueStatus } = require(`@prisma/client`);
const { COLORS } = require(`../../../utils/enums/colors`);

const sum = (array) => array.reduce((s, v) => s += v == null ? 0 : v, 0);
const avg = (array) => array.reduce((s, v) => s += v, 0) / array.length;


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
    if (!exists) return interaction.editReply(`Looks like this match doesn't exist in our database!`);
    const game = await Games.getMatchData({ id: id });
    if (!game.gameType.includes(GameType.SEASON)) return await interaction.editReply(`You can only get match stats for a season game!`);

    // get teams
    const [home, away] = await Promise.all([
        Team.getBy({ id: game.Match.home }),
        Team.getBy({ id: game.Match.away })
    ]);

    // create outputs
    const roundsWonBar = createRoundsWonBar((({ PlayerStats, ...o }) => o)(game));

    const dataOutput = game.PlayerStats.map(p => createMatchPlayerStats(p, game.Match.home, p.Player.team));
    const date = new Date(game.datePlayed).toLocaleString(`en-US`, { dateZone: `CST`, month: `short`, day: `2-digit` });

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `${home.tier} - ${home.name} vs. ${away.name} - ${date}`, url: `https://tracker.gg/valorant/match/${id}` },
        description: `${roundsWonBar}\n${dataOutput.join(`\n`)}`,
        color: COLORS[home.tier],
        footer: { text: `Stats — Match` }
    });

    return await interaction.editReply({ embeds: [embed] })
}

async function sendPlayerStats(/** @type ChatInputCommandInteraction */ interaction, /** @type GuildMember */ guildMember) {

    const currentSeason = await ControlPanel.getSeason();
    const options = interaction.options._hoistedOptions;
    const season = options[1] ? options[1].value : currentSeason;

    if (season > currentSeason) return await interaction.editReply(`Season ${season} hasn't happened yet!`);

    const player = await Player.getBy({ discordID: guildMember.user.id });
    if (player == null) return await interaction.editReply(`This player does not exist in our database!`);

    const playerStats = await Player.getStatsBy({ userID: player.id }, season);
    if (playerStats.length == 0) return await interaction.editReply(`This player doesn't have any stats for season ${season}!`);

    const mmrShow = await ControlPanel.getMMRDisplayState()
    const mmr = mmrShow ? Math.round(player.PrimaryRiotAccount?.MMR.mmrEffective) || undefined : undefined;
    const team = player.Team;
    const processedPlayerStats = playerStats.map(s => {
        const rounds = s.Game.rounds;
        return { ...s, rounds: rounds, totalDamage: s.damage }
    });

    // get agent pool & save as emotes
    const agentEmotes = client.application.emojis.cache;
    const allAgentsPicked = processedPlayerStats.map(ps => ps.agent);
    const agentPercentage = [...new Set(processedPlayerStats.map(ps => ps.agent))].map(a => {
        const agentSanatized = a.toLowerCase().replace(/[^a-z]/, ``);
        const agentEmoteObject = agentEmotes.find(ae => ae.name === agentSanatized);
        return {
            agentName: a,
            agentIcon: `<:${agentSanatized}:${agentEmoteObject.id}>`,
            pickRate: allAgentsPicked.filter(agent => agent === a).length / allAgentsPicked.length
        }
    }).sort((a, b) => b.pickRate - a.pickRate);

    // create the code block module (Team stats if on a team, Sub info if sub)
    const associatedData = season == currentSeason ?
        team ? await createFranchiseStatsModule(player, season) : await createSubOverview(player) :
        ``;

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
    };

    // do calculations and formatting
    const ratingAttack = (summedStats.ratingAttack || 0).toFixed(2)
    const ratingDefense = (summedStats.ratingDefense || 0).toFixed(2)
    const kpr = ((summedStats.totalKills / summedStats.rounds) || 0).toFixed(2);
    const apr = ((summedStats.totalAssists / summedStats.rounds) || 0).toFixed(2);
    const dpr = ((summedStats.totalDeaths / summedStats.rounds) || 0).toFixed(2);
    const dmgpr = ((summedStats.totalDamage / summedStats.rounds) || 0).toFixed(2);
    const fkpr = ((summedStats.firstKills * 100 / summedStats.rounds) || 0).toFixed(2);
    const fdpr = ((summedStats.firstDeaths * 100 / summedStats.rounds) || 0).toFixed(2);
    const plants = summedStats.totalPlants;
    const clutches = summedStats.clutches;
    const avgkast = (summedStats.avgkast || 0).toFixed(2);

    const riotIGN = player.PrimaryRiotAccount.riotIGN;
    const trackerURL = `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(riotIGN)}`

    // prefix for user
    const prefix = player.Team?.Franchise ? player.Team.Franchise.slug : player.Status == LeagueStatus.FREE_AGENT ? `FA` : `RFA`;

    const agentOut = [];
    for (let i = 0; i < agentPercentage.length; i++) {
        if (i <= 2) agentOut.push(`${agentPercentage[i].agentIcon} \` ${(agentPercentage[i].pickRate * 100).toFixed(1)}% \``);
        else agentOut[3] = agentOut[3] ? agentOut[3] += agentPercentage[i].agentIcon : agentPercentage[i].agentIcon;
    }

    const description = [
        `ATK : \` ${ratingAttack} \` // DEF : \` ${ratingDefense} \``,
        [
            mmr ? `MMR: \` ${String(mmr).padStart(3, ` `)} \`` : undefined,
            `Games: \` ${String(processedPlayerStats.length).padStart(2, ` `)} \``
        ].filter(v => v !== undefined).join(` | `),
        associatedData,
        agentOut.join(` | `)
    ];

    const tierLines = await ControlPanel.getMMRCaps(`PLAYER`);
    let embedcolor;
    switch (true) {
        case tierLines.RECRUIT.min < mmr && mmr < tierLines.RECRUIT.max:
            embedcolor = COLORS.RECRUIT
            break;
        case tierLines.PROSPECT.min < mmr && mmr < tierLines.PROSPECT.max:
            embedcolor = COLORS.PROSPECT
            break;
        case tierLines.APPRENTICE.min < mmr && mmr < tierLines.APPRENTICE.max:
            embedcolor = COLORS.APPRENTICE
            break;
        case tierLines.EXPERT.min < mmr && mmr < tierLines.EXPERT.max:
            embedcolor = COLORS.EXPERT
            break;
        case tierLines.MYTHIC.min < mmr && mmr < tierLines.MYTHIC.max:
            embedcolor = COLORS.MYTHIC
            break;

        default:
            embedcolor = 0xE92929;
            break;
    }

    const trackerButton = new ButtonBuilder({
        style: ButtonStyle.Link,
        label: `Tracker`,
        url: trackerURL
    })

    const websiteButton = new ButtonBuilder({
        style: ButtonStyle.Link,
        label: `Match History`,
        url: `https://vdc.gg/player/${guildMember.user.id}`
    })

    // create the embed
    const embed = new EmbedBuilder({
        author: { name: `${[prefix, riotIGN.split(`#`)[0]].join(` | `)}  -  ${`Season ${season} Stats`}`, url: trackerURL },
        description: description.join(`\n`),
        color: embedcolor,
        fields: [
            { name: `Kills/Round`, value: `\`\`\`ansi\n\u001b[0;36m${kpr}\`\`\``, inline: true },
            { name: `Damage/Round`, value: `\`\`\`ansi\n\u001b[0;36m${dmgpr}\`\`\``, inline: true },
            { name: `Assists/Round`, value: `\`\`\`ansi\n\u001b[0;36m${apr}\`\`\``, inline: true },
            { name: `First Kill %`, value: `\`\`\`ansi\n\u001b[0;36m${fkpr} %\`\`\``, inline: true },
            { name: `aKAST`, value: `\`\`\`ansi\n\u001b[0;36m${avgkast} %\`\`\``, inline: true },
            { name: `Clutches`, value: `\`\`\`ansi\n\u001b[0;36m${clutches}\`\`\``, inline: true },
            { name: `First Death %`, value: `\`\`\`ansi\n\u001b[0;36m${fdpr} %\`\`\``, inline: true },
            { name: `Deaths/Round`, value: `\`\`\`ansi\n\u001b[0;36m${dpr}\`\`\``, inline: true },
            { name: `Plants`, value: `\`\`\`ansi\n\u001b[0;36m${plants}\`\`\``, inline: true },

        ],
        footer: { text: `Stats — Player` }
    });
    const components = new ActionRowBuilder({ components: [websiteButton, trackerButton] })
    return await interaction.editReply({ embeds: [embed], components: [components] })
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

/** Create the stats `module` for a player */
function createMatchPlayerStats(player, home, team) {
    const ign = player.Player.PrimaryRiotAccount.riotIGN;

    // collect & organize data for outputs
    const trackerLink = `[${ign.split(`#`)[0]}](https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ign)})`
    const color = team === null ? `[0;30m` : team === home ? `[0;31m` : `[0;34m`; // gray > red > blue

    // agent information
    const agentSanatized = player.agent.toLowerCase().replace(/[^a-z]/, ``);
    const agentEmotes = client.application.emojis.cache;
    const agentEmoteObject = agentEmotes.find(ae => ae.name === agentSanatized);
    const agentEmote = `<:${agentSanatized}:${agentEmoteObject.id}>`;

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

    // return a stats `module` for the specified player
    return `${agentEmote} ${trackerLink} | ${rating} | ${teamName}` + `\n` +
        `\`\`\`ansi\n\u001b${color}${headings.join(` |`)}\n${data.join(` |`)}\`\`\``;
}

/** Create the standings `module` for a franchise if the player is signed to one */
async function createFranchiseStatsModule(player, season) {
    const team = player.Team;
    const franchise = team.Franchise;

    const emote = `<${franchise.Brand.discordEmote}>`;
    const slug = franchise.slug;
    const franchiseName = franchise.name;
    const teamName = team.name;

    const allTeamGames = await Games.getAllBy({ team: team.id, season: season });
    const teamStats = {
        wins: allTeamGames.filter(g => g.winner == team.id).length,
        loss: allTeamGames.filter(g => g.winner !== team.id).length,
        roundsWon: sum(allTeamGames.map(g => g.Match.home === team.id ? g.roundsWonHome : g.roundsWonAway)),
        totalRounds: sum(allTeamGames.map(g => g.rounds))
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
        color + `${((100 * teamStats.roundsWon / teamStats.totalRounds) || 0).toFixed(2)}% `.padStart(6, ` `),
    ];

    // and then format & return the `module`
    return `\n${emote} **${franchiseName}** - ${team.tier[0].toUpperCase() + team.tier.substring(1).toLowerCase()}` + `\n` +
        `\`\`\`ansi\n${color}${data.join(`${color} | `)}\n\`\`\``;
}

/** Create the overview `module` for a sub if the player not on a team */
async function createSubOverview(player) {
    /** @todo When we have extra sub data, we can return sub stats here */

    const subtype = player.Status.leagueStatus === LeagueStatus.FREE_AGENT ? `Free Agent` : `Restricted Free Agent`;
    let tier;

    const mmrCaps = await ControlPanel.getMMRCaps(`PLAYER`);

    if (player.PrimaryRiotAccount.MMR.mmrEffective <= mmrCaps.RECRUIT.max) tier = `Recruit`;
    else if (player.PrimaryRiotAccount.MMR.mmrEffective <= mmrCaps.PROSPECT.max) tier = `Prospect`;
    else if (player.PrimaryRiotAccount.MMR.mmrEffective <= mmrCaps.APPRENTICE.max) tier = `Apprentice`;
    else if (player.PrimaryRiotAccount.MMR.mmrEffective <= mmrCaps.EXPERT.max) tier = `Expert`;
    else tier = `Mythic`;

    const string = `Substitute - ${subtype} - ${tier}`;
    const barlen = 45;
    const padStart = Math.ceil((barlen - string.length) / 2) + string.length;

    return `\n\`\`\`ansi\n\u001b[0;30m ${string.padStart(padStart, ` `).padEnd(barlen, ` `)} \n\`\`\``;
}

// ################################################################################################
// ################################################################################################
