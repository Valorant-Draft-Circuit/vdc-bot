const { Player, ControlPanel } = require("../../../../prisma");
const { prisma } = require(`../../../../prisma/prismadb`); 
const { Tier, GameType } = require(`@prisma/client`);
let increment = 0
async function statsCsv(/** @type ChatInputCommandInteraction */ interaction, { gameType }) {
    interaction.editReply("Generating the CSV, this may take a minute...");
    const season = await ControlPanel.getSeason();
    const stats = (await getPlayerStats(Tier.RECRUIT, gameType, season)).concat(await getPlayerStats(Tier.PROSPECT, gameType, season), await getPlayerStats(Tier.APPRENTICE, gameType, season), await getPlayerStats(Tier.EXPERT, gameType, season), await getPlayerStats(Tier.MYTHIC, gameType, season))
    /* 
      OK i have a moral obligation to explain what this shit does.
      Basically, Nuke wanted code to generate a CSV file to import into sheets of all the stats of the player through the season.
      HOWEVER, he also wanted it of just the tier the player is currently in, so basically i had to get the stats of every player from each tier 
      individually, compile it together, then determine which tier the player is currently in.
      Thats what this code does for most of it till it formats the data, just determines which one is the "true" stats of the player.

    */
    let multipleTierPlayers = (getDuplicates(stats, 'userID').map(a => a.userID)).sort()
    const mmrcaps = await ControlPanel.getMMRCaps('PLAYER');
    for ( let i = 0; i < multipleTierPlayers.length; i++) {
      let playerID = multipleTierPlayers[i]
      let matches = stats.filter(a => a.userID === playerID)
      let player = await Player.getBy({ userID: playerID });
      let mmr = player.PrimaryRiotAccount.MMR.mmrEffective
      let index;
      switch (true) {
                  case (mmrcaps.RECRUIT.min <= mmr && mmr <= mmrcaps.RECRUIT.max):
                      // RECRUIT PLAYER
                      index = stats.findIndex((stat) => stat.id === matches.filter(a => a.tier !== 'RECRUIT')[0].id)
                      stats.splice(index,1);
                      break;
                  case (mmrcaps.PROSPECT.min <= mmr && mmr <= mmrcaps.PROSPECT.max):
                      // PROSPECT PLAYER
                      index = stats.findIndex((stat) => stat.id === matches.filter(a => a.tier !== 'PROSPECT')[0].id)
                      stats.splice(index,1);
                      break;
                  case mmrcaps.APPRENTICE.min <= mmr && mmr <= mmrcaps.APPRENTICE.max:
                      // APPRENTICE PLAYER
                      index = stats.findIndex((stat) => stat.id === matches.filter(a => a.tier !== 'APPRENTICE')[0].id)
                      stats.splice(index,1);
                      break;
                  case mmrcaps.EXPERT.min <= mmr && mmr <= mmrcaps.EXPERT.max:
                      // EXPERT PLAYER
                      index = stats.findIndex((stat) => stat.id === matches.filter(a => a.tier !== 'EXPERT')[0].id)
                      stats.splice(index,1);
                      break;
                  case mmrcaps.MYTHIC.min <= mmr && mmr <= mmrcaps.MYTHIC.max:
                      // MYTHIC PLAYER
                      index = stats.findIndex((stat) => stat.id === matches.filter(a => a.tier !== 'MYTHIC')[0].id)
                      stats.splice(index ,1);
                      break;
              }
    }
    const formattedStats = await formatStats(stats, gameType, season)
    await prisma.$disconnect()
    // convert to CSV and send as file
    var fields = Object.keys(formattedStats[0])
    var replacer = function(key, value) { return value === null ? '' : value } 
    var csv = formattedStats.map(function(row){
    return fields.map(function(fieldName){
        return JSON.stringify(row[fieldName], replacer)
    }).join(',')
    })
    csv.unshift(fields.join(',')) // add header column
    csv = csv.join('\r\n');
    // end of csv conversion
    interaction.editReply({ content: `Stats for ${gameType === GameType.SEASON ? 'Regular Season' : 'Combines'}:`, files: [{ attachment: Buffer.from(csv), name: `stats-${gameType}-season-${season}.csv` }] })
}

// determines duplicates in array and returns the duplicates (NOT the first one, just any duplicate of it)
function getDuplicates(arr, key) {
    const map = {};
    const duplicates = [];

    arr.forEach(item => {
        const keyValue = item[key];
        if (map[keyValue]) {
            duplicates.push(item);
        } else {
            map[keyValue] = true;
        }
    });

    return duplicates;
}

// say hello to my terrible website code :)
async function getPlayerStats(tier, gameType, season) {
  let stats = await prisma.playerStats.groupBy({
    where: {
      Game: {
        gameType: gameType,
        season: season,
        tier: tier,
      },
    },
    by: ['userID'],
    _sum: {
      kills: true,
      deaths: true,
      assists: true,
      plants: true,
      defuses: true,
      firstKills: true,
      firstDeaths: true,
      tradeKills: true,
      tradeDeaths: true,
      ecoKills: true,
      antiEcoKills: true,
      ecoDeaths: true,
      exitKills: true,
      clutches: true,
    },
    _avg: {
      acs: true,
      ratingAttack: true,
      ratingDefense: true,
      kast: true,
      kills: true,
      assists: true,
      deaths: true,
      firstKills: true,
      firstDeaths: true,
      hsPercent: true,
    },
    _count: {
      userID: true,
    },
  })
  for (let i = 0; i < stats.length; i++) {
    stats[i].tier = tier
    stats[i].id = increment
    increment++
  }
  return stats
}

/* 
  OK now to explain the bad code on the website cuz its in travs pretty little bot.
  BASICALLY in order to get any data that is individual data (like name, team, contract status) OR any data that isnt in the playerStats table, 
  you have to write a separate thing from the playerStats groupBy query since for some reason prisma won't let you grab other data as well from it.
  That's what this code does, it gets all the rest of the data that it needs, 
  then sorts everything to a common key (userID), then combines everything together and formats it all.
*/
async function formatStats(playerStats, gameType, season) {
  
  // find is literally just a list of all the userIDs so i can easily find all the data from just those players
  let find = []
  playerStats.forEach(function (arrayItem) {
    find.push(arrayItem.userID)
  })

  // first individual data grab, gets the contract status, riotIGN, and team name
  const names = await prisma.user.findMany({
    where: {
      id: {
        in: find,
      },
    },
    select: {
      id: true,
      PrimaryRiotAccount: {
        select: {
          riotIGN: true,
        },
      },
      Status: {
        select: {
          contractStatus: true,
        },
      },
      Team: {
        select: {
          name: true,
        },
      },
    },
  })

  // all this does is let me get all the rounds for per round stats
  const playerStatsWithGames = await prisma.playerStats.findMany({
    where: {
      userID: {
        in: find, 
      },
      Game: {
        season: season, // Filter by the current season
        gameType: gameType,
      },
    },
    include: {
      Game: {
        select: {
          rounds: true, // Select only the rounds from each game
        },
      },
    },
  })

  // adds up all the rounds for each player
  const rounds = find.map((userId) => {
    // Get all PlayerStats for this user
    const userPlayerStats = playerStatsWithGames.filter((ps) => ps.userID === userId)

    // Sum up the rounds for all the games associated with this user
    const totalRounds = userPlayerStats.reduce((sum, playerStat) => {
      return sum + (playerStat.Game?.rounds || 0) // Add rounds for each related Game
    }, 0)

    return { userID: userId, totalRounds } // Return an object with userID and totalRounds
  })

  // this sorts everything by userID so that when i merge them together they all line up correctly
  const sortedNames = [...names].sort((a, b) => (a.id > b.id ? 1 : -1))
  const sortedRounds = [...rounds].sort((a, b) => (a.userID > b.userID ? 1 : -1))
  const sortedStats = [...playerStats].sort((a, b) => (a.userID > b.userID ? 1 : -1))

  // combining everything together into playerStats
  for (let i = 0; i < names.length; i++) {
    sortedNames[i].Team === null ? (sortedNames[i].Team = 'FA/RFA') : (sortedNames[i].Team = sortedNames[i].Team.name)
    playerStats[i] = { ...sortedStats[i], ...sortedNames[i], ...sortedRounds[i] }
  }

  // big thingy that formats everything nicely so its easy to work with
  const formattedStats = playerStats.map((stats) => ({
    name: stats.PrimaryRiotAccount?.riotIGN,
    team: stats.Team,
    contractStatus: stats.Status?.contractStatus,
    matchesPlayed: stats._count.userID,
    rounds: stats.totalRounds,
    acs: stats._avg.acs,
    rating: (stats._avg.ratingAttack + stats._avg.ratingDefense) / 2,
    attackRating: stats._avg.ratingAttack,
    defenseRating: stats._avg.ratingDefense,
    totalKills: stats._sum.kills,
    totalDeaths: stats._sum.deaths,
    totalAssists: stats._sum.assists,
    totalPlants: stats._sum.plants,
    totalDefuses: stats._sum.defuses,
    totalEcoKills: stats._sum.ecoKills,
    totalAntiecoKills: stats._sum.antiEcoKills,
    totalTradeKills: stats._sum.tradeKills,
    totalTradeDeaths: stats._sum.tradeDeaths,
    totalClutches: stats._sum.clutches,
    kdr: stats._sum.kills / stats._sum.deaths,
    kast: stats._avg.kast,
    kpm: stats._avg.kills,
    kpr: stats._sum.kills / stats.totalRounds,
    apm: stats._avg.assists,
    apr: stats._sum.assists / stats.totalRounds,
    dpm: stats._avg.deaths,
    dpr: stats._sum.deaths / stats.totalRounds,
    firstKills: stats._sum.firstKills,
    fkpm: stats._avg.firstKills,
    fkpr: stats._sum.firstKills / stats.totalRounds,
    firstDeaths: stats._sum.firstDeaths,
    fdpm: stats._avg.firstDeaths,
    fdpr: stats._sum.firstDeaths / stats.totalRounds,
    hs: stats._avg.hsPercent,
  }))
  return formattedStats
}
module.exports = { statsCsv };