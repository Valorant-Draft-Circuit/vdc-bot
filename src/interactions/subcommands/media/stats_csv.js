const { prisma } = require(`../../../../prisma/prismadb`); 
const { Tier, GameType } = require(`@prisma/client`);
const season = 8
async function statsCsv(/** @type ChatInputCommandInteraction */ interaction, { gameType }) {
    const stats = (await getPlayerStats(Tier.RECRUIT, gameType, season)).concat(await getPlayerStats(Tier.PROSPECT, gameType, season), await getPlayerStats(Tier.APPRENTICE, gameType, season), await getPlayerStats(Tier.EXPERT, gameType, season), await getPlayerStats(Tier.MYTHIC, gameType, season))
    let thing = (getDuplicates(stats, 'userID').map(a => a.userID)).sort()
    console.log(thing)
    console.log(thing.length)
    const formattedStats = await formatStats(stats, gameType)
    //TODO: FIGURE OUT HOW TO MAKE IT SO ITS ONLY STATS FROM CURRENT TIER THEY ARE IN
    // prob get all problem players, figure out tier, get stats from that tier for them
    await prisma.$disconnect()
    //convert to CSV and send as file
    // const csv = json2csv.parse(formattedStats)
    //console.log((formattedStats.reverse()).splice(0, 10))
    interaction.editReply({files: [{ attachment: Buffer.from(formattedStats), name: `stats-${gameType}-season-${season}.json` }]})
    // var fields = Object.keys(formattedStats[0])
    // var replacer = function(key, value) { return value === null ? '' : value } 
    // var csv = formattedStats.map(function(row){
    // return fields.map(function(fieldName){s
    //     return JSON.stringify(row[fieldName], replacer)
    // }).join(',')
    // })
    // csv.unshift(fields.join(',')) // add header column
    // csv = csv.join('\r\n');
    // console.log(csv)
    // interaction.editReply({ content: `Here are the stats for the ${matchType} season!`, files: [{ attachment: Buffer.from(csv), name: `stats-${matchType}-season-${season}.csv` }] })
}
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
async function getPlayerStats(tier, gameType, season) {
  return await prisma.playerStats.groupBy({
    where: {
      Game: {
        gameType: gameType,
        season: season,
        tier: tier,
        // datePlayed: {
        //   gte: new Date('2025-06-30'),
        // },
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
}

async function formatStats(playerStats, gameType) {
  let find = []

  playerStats.forEach(function (arrayItem) {
    find.push(arrayItem.userID)
  })
//   console.log(find.length)
//   console.log(find)
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
      Team: {
        select: {
          name: true,
        },
      },
    },
  })
//   names.forEach(function (arrayItem) {
//     let thing = find.indexOf(arrayItem.id)
//     if (thing > -1) {
//       find.splice(thing, 1)
//     }
//   })
//   console.log(find.length)
//   console.log(find)
  // Get rounds from games associated with playerStats
  
  const dateFilter = new Date('2025-06-30')

  const playerStatsWithGames = await prisma.playerStats.findMany({
    where: {
      userID: {
        in: find, // Only consider the users from the list
      },
      Game: {
        season: season, // Filter by the current season
        gameType: gameType,
        // datePlayed: {
        //   gte: dateFilter, // Filter by datePlayed after the specified date
        // },
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

  // Create an array of objects with userID and totalRounds
  const rounds = find.map((userId) => {
    // Get all PlayerStats for this user
    const userPlayerStats = playerStatsWithGames.filter((ps) => ps.userID === userId)

    // Sum up the rounds for all the games associated with this user
    const totalRounds = userPlayerStats.reduce((sum, playerStat) => {
      return sum + (playerStat.Game?.rounds || 0) // Add rounds for each related Game
    }, 0)

    return { userID: userId, totalRounds } // Return an object with userID and totalRounds
  })
  console.log(names.length)
  console.log(playerStats.length)
  console.log(rounds.length)
  const sortedNames = [...names].sort((a, b) => (a.id > b.id ? 1 : -1))
  const sortedRounds = [...rounds].sort((a, b) => (a.userID > b.userID ? 1 : -1))
  const sortedStats = [...playerStats].sort((a, b) => (a.userID > b.userID ? 1 : -1))
  for (let i = 0; i < names.length; i++) {
    sortedNames[i].Team === null ? (sortedNames[i].Team = 'FA/RFA') : (sortedNames[i].Team = sortedNames[i].Team.name)
    playerStats[i] = { ...sortedStats[i], ...sortedNames[i], ...sortedRounds[i] }
  }
  const formattedStats = playerStats.map((stats) => ({
    name: stats.PrimaryRiotAccount?.riotIGN,
    team: stats.Team,
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