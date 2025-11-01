const fs = require(`fs`);
const { LeagueStatus, ContractStatus, MatchType } = require(`@prisma/client`);

const { Player, Team, ControlPanel } = require(`../../../../prisma`);
const { EmbedBuilder, ChatInputCommandInteraction, } = require(`discord.js`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { CHANNELS, ROLES } = require(`../../../../utils/enums`)

// 2.5 pts - First Place
const first = [`Decaf`, `Calamity`, `Surge`, `Latte`];

// 2 pts - Second Place
const second = [`Mayhem`, `Astral Annihilators`, `Espresso`, `Anarchy`];

// 1 pts - Third/Fourth Place
const thirdfourth = [`Phantoms`, `Snake Eyes`, `Crest`, `Hydrus`, `Draco`, `Purple Iris`, `Dons`, `Meteor Marauders`];


async function generateLottery(/** @type ChatInputCommandInteraction */ interaction, tier) {

    const userRoles = interaction.member._roles;
    if (!userRoles.includes(ROLES.OPERATIONS.ADMIN)) return await interaction.editReply({ content: `You don't have the Admin role and cannot use this command!` });

    // get current season from the database
    const season = await ControlPanel.getSeason();

    // check to make sure the draft hasn't already been generated for this season
    const draftDoneCheck = await prisma.draft.findMany({
        where: { AND: [{ season: season }, { tier: tier }] }
    });
    if (draftDoneCheck.length !== 0) return await interaction.editReply(`The ${tier} draft lottery for season ${season} has already been generated.`);

    const activeTeams = await prisma.teams.findMany({ where: { active: true }, select: { id: true, name: true } });

    const activeTeamsWinLoss = [];
    for (let i = 0; i < activeTeams.length; i++) {
        const activeTeamMatchDays = await prisma.matches.findMany({
            where: {
                AND: [
                    { season: season - 1 }, { matchType: MatchType.BO2 },
                    { OR: [{ home: activeTeams[i].id }, { away: activeTeams[i].id }] }
                ]
            }, include: { Games: true }
        });

        let gw = 0;
        let gl = 0
        activeTeamMatchDays.forEach(m => {
            gw += m.Games.filter(g => g.winner == activeTeams[i].id).length;
            gl += m.Games.filter(g => g.winner != activeTeams[i].id).length;
        });

        activeTeamsWinLoss.push({ ...activeTeams[i], win: gw, loss: gl });
    }

    // console.log(activeTeamsWinLoss)
    // return
    await interaction.editReply({ content: `Generating team odds...` });
    logger.log(`VERBOSE`, `VDC Draft — \`${tier}\` : Generating team odds...`);
    const allTeams = await prisma.teams.findMany();
    const postPoints = [];

    for (let i = 0; i < first.length; i++) {
        const team = allTeams.find(t => t.name == first[i]);
        postPoints.push({ id: team.id, name: team.name, postPoints: 2.5 });
    }
    for (let j = 0; j < second.length; j++) {
        const team = allTeams.find(t => t.name == second[j]);
        postPoints.push({ id: team.id, name: team.name, postPoints: 2 });
    }
    for (let k = 0; k < thirdfourth.length; k++) {
        const team = allTeams.find(t => t.name == thirdfourth[k]);
        postPoints.push({ id: team.id, name: team.name, postPoints: 1 });
    }
    for (let l = 0; l < allTeams.length; l++) {
        if (!postPoints.find(ppt => ppt.id === allTeams[l].id)) postPoints.push({ id: allTeams[l].id, name: allTeams[l].name, postPoints: 0 });
    }

    const teamWinLoss = activeTeamsWinLoss.filter(r => r.win !== 0 && r.loss !== 0);
    const newTeam = activeTeamsWinLoss.filter(r => r.win == 0 && r.loss == 0);

    // console.log(teamWinLoss)
    // console.log(newTeam)
    // return


    await interaction.editReply({ content: `Getting info from the database...` });
    logger.log(`VERBOSE`, `VDC Draft — \`${tier}\` : Getting info from the database...`);

    // get MMR tier lines from the database
    const tierMMR = (await ControlPanel.getMMRCaps(`PLAYER`))[tier];

    // get active teams who will be drafting and active players to draft from (for general managers, a check is included to only add playing GMs to the draft)
    const draftTeams = await Team.getAllActiveByTier(tier);
    const draftPlayers = (await Player.filterAllByStatus([
        LeagueStatus.DRAFT_ELIGIBLE, LeagueStatus.FREE_AGENT,
        LeagueStatus.SIGNED, LeagueStatus.GENERAL_MANAGER
    ])).filter((p) => p.Status.leagueStatus === LeagueStatus.GENERAL_MANAGER ? p.Status.contractStatus === ContractStatus.SIGNED : true);

    // filter players to the tier that the draft is being rolled for
    const tierPlayers = draftPlayers.filter((p) =>
        p.PrimaryRiotAccount?.mmr &&
        p.PrimaryRiotAccount.MMR.mmrEffective < tierMMR.max &&
        p.PrimaryRiotAccount.MMR.mmrEffective >= tierMMR.min
    );
    let amountOfPlayers = tierPlayers.length;
    let teamScore = [];
    let lotteryScore = 0;


    await interaction.editReply({ content: `Processing last season stats...` });
    logger.log(`VERBOSE`, `VDC Draft — \`${tier}\` : Processing last season stats...`);
    // const tierGames = await Games.getAllBy({ tier: tier });
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
            const loss = winloss[0].loss;

            teamWins.push({ ...team, wins: win, loss: loss });
        }
    });

    // console.log(teamWins)


    await interaction.editReply({ content: `Creating weights...` });
    logger.log(`VERBOSE`, `VDC Draft — \`${tier}\` : Creating weights...`);
    // return
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

    // console.log(`HIGHEST`, highest)
    // console.log(`TWP`, teamWinPercent)

    let teamCheck = [];

    teamScore.forEach((team) => {
        const newTeamCheck = newTeam.filter((t) => t.id === team.id);
        if (newTeamCheck[0]?.id === team.id) {
            const score = highest + 0.02 * (teamWinPercent.length / 12);

            // console.log(`score`, score, team.name);

            teamCheck.push({ ...team, score: score });
            lotteryScore += score;
        } else {
            const score = team.score;

            // console.log(`score`, score, team.name);
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
        // console.log(`Lottery`);
        // console.log(lottery);
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
                // console.log(`F:`, snakedTeams[j].franchise, `Season:`, season, `Pick:`, pick, `round:`, round, tier);
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
                // console.log(`F:`, snakedTeams[l].franchise, `Season:`, season, `Pick:`, pick, `round:`, round, tier);
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
        // console.log(`-----`);
    }
    //running the remaining picks


    await interaction.editReply({ content: `Generating database info...` });
    logger.log(`VERBOSE`, `VDC Draft — \`${tier}\` : Generating database info...`);
    // NON-KEEPER ROUND
    if (remainingPicks != 0) {
        if (Math.ceil(rounds) % 2 == 1) {
            for (let i = 0; i < remainingPicks; i++) {
                // console.log(`F:`, snakedTeams[i].franchise, `Season:`, season, `Pick:`, pick, `round:`, round, tier);
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
                // console.log(`F:`, snakedTeams[l].franchise, `Season:`, season, `Pick:`, pick, `round:`, round, tier);
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
        // console.log(`-----`);
    }

    // KEEPER ROUND
    snakedTeams.forEach((team) => {
        // console.log(`F:`, team.franchise, `Season:`, season, `Pick:`, pick, `round:`, 99, tier, `Keeper:`, true);

        // console.log(team)
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



    // Create the entries in the database
    await interaction.editReply({ content: `Writing results & sending to the database...` });
    logger.log(`VERBOSE`, `VDC Draft — \`${tier}\` : Writing results & sending to the database...`);
    fs.writeFileSync(`./cache/draft_lottery_${tier}.json`, JSON.stringify(draftLottery, ` `, 2));
    await prisma.draft.createMany({ data: draftLottery });


    // POST THE RESULTS
    await interaction.editReply({ content: `Posting results in <#${CHANNELS.ANNOUNCEMENTS.FM}>...` });
    logger.log(`VERBOSE`, `VDC Draft — \`${tier}\` : Posting results in <#${CHANNELS.ANNOUNCEMENTS.FM}>...`);

    const delay /** in MS */ = 15 * 1000;

    const gmAccouncements = await interaction.guild.channels.fetch(CHANNELS.ANNOUNCEMENTS.FM);
    await gmAccouncements.send({ content: `### Hey <@&${ROLES.OPERATIONS.GM}>/<@&${ROLES.OPERATIONS.AGM}> - The \`${tier}\` Draft Lottery is beginning!` });
    for (let i = 0; i < teamOrder.length; i++) {
        const team = draftTeams.find(t => t.name == teamOrder[i].value);

        const msg = await gmAccouncements.send({
            content: `Pick \`${String(i + 1).padStart(2, ` `)}\` goes to... 🥁 (<t:${(Math.round(Date.now() / 1000)) + (delay / 1000)}:R>)`
        });

        await new Promise(resolve => setTimeout(resolve, delay));
        await msg.edit({
            content: `Pick \`${String(i + 1).padStart(2, ` `)}\` goes to: <${team.Franchise.Brand.discordEmote}> **${team.Franchise.slug}** - ${team.name}!`
        })
    }
    await gmAccouncements.send({ content: `-# The \`${tier}\` Draft Lottery has been generated! There are \`${amountOfPlayers}\` draftable players, resulting in \`${Math.ceil(rounds)}\` rounds` });


    // output
    const embed = new EmbedBuilder({
        author: { name: `VDC Draft Generator` },
        description: `Teams for ${tier} pick in the following order. The database has been updated to show these picks.`,
        color: 0xe92929,
        fields: [
            ...teamOrder,
            { name: `Players: `, value: amountOfPlayers, inline: true },
            { name: `Rounds: `, value: `${Math.ceil(rounds)}`, inline: true },
        ],
        footer: { text: `Valorant Draft Circuit - Draft` },
    });

    logger.log(`VERBOSE`, `VDC Draft — \`${tier}\` : Done!`);
    return await interaction.editReply({ content: ``, embeds: [embed], files: [`./cache/draft_lottery_${tier}.json`] });
}

module.exports = { generateLottery }