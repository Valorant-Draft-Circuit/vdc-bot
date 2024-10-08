const fs = require("fs");
const { LeagueStatus, ContractStatus, Tier } = require("@prisma/client");

const { Franchise, Player, Team, Games, ControlPanel } = require("../../../../prisma");
const { EmbedBuilder, ChatInputCommandInteraction, } = require("discord.js");
const { prisma } = require("../../../../prisma/prismadb");
const { CHANNELS } = require("../../../../utils/enums");

// unable to get post points remove when able too
const postPoints = [
    { id: 35, postPoints: 1 },
    { id: 4, postPoints: 2.5 },
    { id: 28, postPoints: 1 },
    { id: 31, postPoints: 2 },
    { id: 30, postPoints: 0 },
    { id: 36, postPoints: 0 },
    { id: 19, postPoints: 2.5 },
    { id: 33, postPoints: 1 },
    { id: 25, postPoints: 2 },
    { id: 32, postPoints: 1 },
    { id: 18, postPoints: 0 },
    { id: 3, postPoints: 0 },
    { id: 41, postPoints: 0 },
    { id: 26, postPoints: 0 },
    { id: 16, postPoints: 1 },
    { id: 10, postPoints: 2.5 },
    { id: 24, postPoints: 1 },
    { id: 23, postPoints: 2 },
    { id: 14, postPoints: 0 },
    { id: 8, postPoints: 0 },
    { id: 15, postPoints: 0 },
    { id: 22, postPoints: 0 },
    { id: 11, postPoints: 2 },
    { id: 13, postPoints: 1 },
    { id: 12, postPoints: 0 },
    { id: 43, postPoints: 2.5 },
    { id: 6, postPoints: 1 },
];
const teamWinLoss = [
    { id: 35, win: 11, lose: 9 },
    { id: 4, win: 11, lose: 9 },
    { id: 28, win: 11, lose: 9 },
    { id: 31, win: 10, lose: 10 },
    { id: 30, win: 10, lose: 10 },
    { id: 36, win: 7, lose: 13 },
    { id: 19, win: 22, lose: 6 },
    { id: 33, win: 17, lose: 11 },
    { id: 25, win: 17, lose: 11 },
    { id: 32, win: 15, lose: 13 },
    { id: 18, win: 14, lose: 14 },
    { id: 3, win: 11, lose: 17 },
    { id: 41, win: 10, lose: 16 },
    { id: 26, win: 4, lose: 22 },
    { id: 16, win: 19, lose: 9 },
    { id: 10, win: 17, lose: 11 },
    { id: 24, win: 16, lose: 12 },
    { id: 23, win: 15, lose: 13 },
    { id: 14, win: 14, lose: 15 },
    { id: 8, win: 12, lose: 16 },
    { id: 15, win: 11, lose: 17 },
    { id: 22, win: 9, lose: 19 },
    { id: 11, win: 14, lose: 4 },
    { id: 13, win: 12, lose: 6 },

    { id: 43, win: 11, lose: 7 },
    { id: 12, win: 8, lose: 10 },
    { id: 6, win: 5, lose: 13 },
];
const newFrachise = [];

const newTeam = [
    { id: 38 },
    { id: 44 },
    { id: 39 },
    { id: 1 },
    { id: 2 },
    { id: 27 },
    { id: 45 },
    { id: 20 },
    { id: 9 },
    { id: 5 },
];


async function generateLottery(/** @type ChatInputCommandInteraction */ interaction, tier) {
    console.log(tier);

    // get current season from the database
    const currentSeasonResponse = await prisma.controlPanel.findFirst({
        where: { name: `current_season` },
    });
    const season = Number(currentSeasonResponse.value);

    // check to make sure the draft hasn't already been generated for this season
    const draftDoneCheck = await prisma.draft.findMany({
        where: { AND: [{ season: season }, { tier: tier }] },
    });
    console.log(draftDoneCheck.length);
    if (draftDoneCheck.length !== 0) return await interaction.editReply(`The ${tier} draft lottery for season ${season} has already been generated.`);

    // get MMR tier lines from the database
    const mmrCapResponse = await prisma.controlPanel.findMany({ where: { name: { contains: `mmr_cap_player` } }, });
    const prospectMMRCap = mmrCapResponse.find((r) => r.name === `prospect_mmr_cap_player`).value;
    const apprenticeMMRCap = mmrCapResponse.find((r) => r.name === `apprentice_mmr_cap_player`).value;
    const expertMMRCap = mmrCapResponse.find((r) => r.name === `expert_mmr_cap_player`).value;

    // store all MMR bounds in array and grab the relevant MMR bounds to store in tierMMR
    const tierMMRBounds = [
        { name: Tier.PROSPECT, high: prospectMMRCap, low: 0 },
        { name: Tier.APPRENTICE, high: apprenticeMMRCap, low: prospectMMRCap },
        { name: Tier.EXPERT, high: expertMMRCap, low: apprenticeMMRCap },
        { name: Tier.MYTHIC, high: 999, low: expertMMRCap },
    ];
    const tierMMR = tierMMRBounds.filter((m) => m.name === tier)[0];

    // get active teams who will be drafting and active players to draft from (for general managers, a check is included to only add playing GMs to the draft)
    const draftTeams = await Team.getAllActiveByTier(tier);
    const draftPlayers = (
        await Player.filterAllByStatus([
            LeagueStatus.DRAFT_ELIGIBLE,
            LeagueStatus.FREE_AGENT,
            LeagueStatus.SIGNED,
            LeagueStatus.GENERAL_MANAGER,
        ])
    ).filter((p) => p.Status.leagueStatus === LeagueStatus.GENERAL_MANAGER ? p.Status.contractStatus === ContractStatus.SIGNED : true);

    // filter players to the tier that the draft is being rolled for
    const tierPlayers = draftPlayers.filter((p) =>
        p.PrimaryRiotAccount?.mmr &&
        p.PrimaryRiotAccount.MMR.mmrEffective < tierMMR.high &&
        p.PrimaryRiotAccount.MMR.mmrEffective >= tierMMR.low
    );
    let amountOfPlayers = tierPlayers.length;
    let teamScore = [];
    let lotteryScore = 0;

    const tierGames = await Games.getAllBy({ tier: tier });
    let teamWins = [];
    draftTeams.forEach((team) => {
        //const win = tierGames.filter((g) => g.winner === team.id).length;
        const winloss = teamWinLoss.filter((g) => g.id === team.id);
        if (!winloss[0]) {
            const win = 1;
            const loss = 1;
            teamWins.push({ ...team, wins: win, loss: loss });
        } else {
            const win = winloss[0].win;
            const loss = winloss[0].lose;

            teamWins.push({ ...team, wins: win, loss: loss });
        }
    });

    let teamWinPercent = [];
    teamWins.forEach((team) => {
        let winPercent = team.wins / (team.wins + team.loss);
        const teamPostPoints = postPoints.filter((p) => team.id === p.id);

        if (!teamPostPoints[0]) {
            const postPoints = 0;

            teamWinPercent.push({
                ...team,
                winPercent: winPercent,
                postPoints: postPoints,
            });
        } else {
            const postPoints = teamPostPoints[0].postPoints;
            teamWinPercent.push({
                ...team,
                winPercent: winPercent,
                postPoints: postPoints,
            });
        }
    });

    //get score

    let highest = 0;
    teamWinPercent.forEach((team) => {
        const A = team.winPercent * 0.7;

        const B = team.postPoints * 0.3;

        const score = 2 - A - B;

        teamScore.push({ ...team, score: score });

        if (score > highest) {
            highest = score;
        }
    });

    let teamCheck = [];

    teamScore.forEach((team) => {
        const newTeamCheck = newTeam.filter((t) => t.id === team.id);
        if (newTeamCheck[0]?.id === team.id) {
            const score = highest + 0.02 * (teamWinPercent.length / 12);

            console.log("score" + score, team.name);

            teamCheck.push({ ...team, score: score });
            lotteryScore += score;
        } else {
            const score = team.score;

            console.log("score" + score, team.name);
            lotteryScore += score;

            teamCheck.push({ ...team, score: score });
        }
    });

    //get team draft %

    let teamdraftScore = [];

    teamCheck.forEach((team) => {
        let draftScore = team.score / lotteryScore;

        teamdraftScore.push({ ...team, weight: draftScore });
    });

    const rounds = amountOfPlayers / teamdraftScore.length;
    const remainingPicks = amountOfPlayers % teamdraftScore.length;

    const snakedTeams = [];

    //generating lottery weight
    let teamLottery = [];

    teamdraftScore.forEach((team) => {
        const teamWeight = team.weight * 10000;

        for (let i = 0; i < teamWeight; i++) {
            teamLottery.push(team);
        }
    });

    while (teamLottery.length > 0) {
        const lottery = Math.floor(Math.random() * teamLottery.length);
        console.log(`Lottery`);
        console.log(lottery);
        const team = teamLottery[lottery];
        //cut from teams add to snakedTeams
        snakedTeams.push(team);
        teamLottery = teamLottery.filter((t) => t !== team);
    }

    const draftLottery = [];

    let pick = 1;
    let round = 1;
    for (let i = 1; i <= rounds; i++) {
        if (i % 2) {
            //run the picks in normal order
            for (let j = 0; j < snakedTeams.length; j++) {
                console.log(`Franchise:`, snakedTeams[j].franchise, `Season:`, season, `Pick:`, pick, `round:`, round, tier);
                draftLottery.push({
                    season: season,
                    tier: tier,
                    round: round,
                    pick: pick,
                    franchise: snakedTeams[j].franchise,
                    // team: draftTeams.find(t => t.Franchise.id === snakedTeams[j].franchise && t.tier === tier).name
                });
                pick++;
            }
        } else {
            //run picks in reverse order
            for (let l = snakedTeams.length - 1; l >= 0; l--) {
                console.log(`Franchise:`, snakedTeams[l].franchise, `Season:`, season, `Pick:`, pick, `round:`, round, tier);
                draftLottery.push({
                    season: season,
                    tier: tier,
                    round: round,
                    pick: pick,
                    franchise: snakedTeams[l].franchise,
                    // team: draftTeams.find(t => t.Franchise.id === snakedTeams[l].franchise && t.tier === tier).name
                });
                pick++;
            }
        }
        round++;
        pick = 1;
        console.log(`-----`);
    }
    //running the remaining picks

    if (remainingPicks != 0) {
        if (Math.ceil(rounds) % 2 == 1) {
            for (let i = 0; i < remainingPicks; i++) {
                console.log(`Franchise:`, snakedTeams[i].franchise, `Season:`, season, `Pick:`, pick, `round:`, round, tier);
                draftLottery.push({
                    season: season,
                    tier: tier,
                    round: round,
                    pick: pick,
                    franchise: snakedTeams[i].franchise,
                    // team: draftTeams.find(t => t.Franchise.id === snakedTeams[i].franchise && t.tier === tier).name
                });
                pick++;
            }
        } else {
            const stopPicks = snakedTeams.length - remainingPicks - 1;
            for (let l = snakedTeams.length - 1; l > stopPicks; l--) {
                console.log(`Franchise:`, snakedTeams[l].franchise, `Season:`, season, `Pick:`, pick, `round:`, round, tier);
                draftLottery.push({
                    season: season,
                    tier: tier,
                    round: round,
                    pick: pick,
                    franchise: snakedTeams[l].franchise,
                    // team: draftTeams.find(t => t.Franchise.id === snakedTeams[l].franchise && t.tier === tier).name
                });
                pick++;
            }
        }
        pick = 1;
        console.log(`-----`);
    }
    snakedTeams.forEach((team) => {
        console.log(`Franchise:`, team.franchise, `Season:`, season, `Pick:`, pick, `round:`, 99, tier, "Keeper:", true);

        console.log(team)
        draftLottery.push({
            season: season,
            tier: tier,
            round: 99,
            pick: pick,
            franchise: team.franchise,
            keeper: true,
            // team: draftTeams.find(t => t.Franchise.id === snakedTeams[l].franchise && t.tier === tier).name
        });
        pick++;
    });

    const teamOrder = [];

    snakedTeams.forEach((team) => {
        teamOrder.push({
            name: team.Franchise.slug,
            value: team.name,
        });
    });

    fs.writeFileSync(`./cache/draft_lottery_${tier}.json`, JSON.stringify(draftLottery, ` `, 2));
    // console.log(teamOrder);
    await prisma.draft.createMany({ data: draftLottery });

    const embed = new EmbedBuilder({
        author: { name: "VDC Draft Generator" },
        description: `Teams for ${tier} pick in the following order. The database has been updated to show these picks.`,
        color: 0xe92929,
        fields: [
            ...teamOrder,
            { name: "Players: ", value: amountOfPlayers, inline: true },
            { name: "Rounds: ", value: `${Math.ceil(rounds)}`, inline: true },
        ],
        footer: { text: `Valorant Draft Circuit - Draft` },
    });

    return await interaction.editReply({ embeds: [embed], files: [`./cache/draft_lottery_${tier}.json`], });
}

module.exports = { generateLottery }