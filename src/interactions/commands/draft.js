const { Franchise, Player, Team, Games } = require("../../../prisma");
const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,

  ChatInputCommandInteraction,
} = require("discord.js");

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

module.exports = {
  name: "draft",
  async execute(/** @type ChatInputCommandInteraction */ interaction) {
    switch (interaction.options._subcommand) {
      case `generate-lottery`:
        await interaction.deferReply();

        const { _hoistedOptions } = interaction.options;
        const tier = _hoistedOptions[0].value;

        await draft(interaction, tier);
        break;
    }
  },
};

async function draft(interaction, tier) {
  console.log(tier);

  const draftTeams = await Team.getAllActiveByTier(tier);

  //const draftPlayers = Player.filter((p) => p.tier === tier);
  let teamScore = [];
  let lotteryScore = 0;

  const tierGames = await Games.getAllBy({
    tier: tier,
  });
  let totalWins = 0;
  let teamWins = [];
  draftTeams.forEach((team) => {
    const win = tierGames.filter((g) => g.winner === team.id).length;
    totalWins += win;
    console.log(win);
    teamWins.push({ ...team, wins: win });
  });
  let totalTeamGames;
  //used because of missing data/different amount of games played should be removed when able to access loses
  if (tier === "PROSPECT") {
    totalTeamGames = 18;
  } else if (tier === "EXPERT") {
    totalTeamGames = 28;
  } else {
    totalTeamGames = (totalWins * 2) / teamWins.length;
  }
  let teamWinPercent = [];
  teamWins.forEach((team) => {
    const winPercent = team.wins / totalTeamGames;
    const teamPostPoints = postPoints.filter((p) => team.id === p.id);

    teamWinPercent.push({
      ...team,
      winPercent: winPercent,
      postPoints: teamPostPoints[0].postPoints,
    });
  });

  //get score
  teamWinPercent.forEach((team) => {
    const A = team.winPercent * 0.7;

    const B = team.postPoints * 0.3;
    const score = 2 - A - B;

    teamScore.push({ ...team, score: score });
    lotteryScore += score;
  });

  //get team draft %

  let teamdraftScore = [];

  teamScore.forEach((team) => {
    let draftScore = team.score / lotteryScore;

    teamdraftScore.push({ ...team, weight: draftScore });
  });
  console.log(teamdraftScore);

  let amountOfPlayers = 15;

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
    console.log(lottery);
    const team = teamLottery[lottery];
    //cut from teams add to snakedTeams
    snakedTeams.push(team);
    teamLottery = teamLottery.filter((t) => t !== team);
  }
  for (let i = 1; i <= rounds; i++) {
    if (i % 2) {
      //run the picks in normal order
      for (let j = 0; j < snakedTeams.length; j++) {
        console.log(snakedTeams[j]);
      }
    } else {
      //run picks in reverse order
      for (let l = snakedTeams.length - 1; l >= 0; l--) {
        console.log(snakedTeams[l]);
      }
    }
  }
  //running the remaining picks
  if (remainingPicks != 0) {
    if (rounds % 2 == 1) {
      for (let i = 0; i < remainingPicks; i++) {
        console.log(snakedTeams[i]);
      }
    } else {
      const stopPicks = snakedTeams.length - remainingPicks - 1;
      for (let l = snakedTeams.length - 1; l > stopPicks; l--) {
        console.log(snakedTeams[l]);
      }
    }
  }

  const teamOrder = [];

  snakedTeams.forEach((team) => {
    teamOrder.push({ name: team.Franchise.slug, value: team.name });
  });
  console.log(teamOrder);

  const embed = new EmbedBuilder({
    author: { name: "VDC Draft Generator" },
    description: `Teams for ${tier} pick in the following order`,
    color: 0xe92929,
    fields: teamOrder,
    footer: { text: `Valorant Draft Circuit - Draft` },
  });

  return await interaction.editReply({ embeds: [embed] });
}
