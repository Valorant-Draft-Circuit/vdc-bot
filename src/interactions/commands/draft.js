const { LeagueStatus, ContractStatus } = require("@prisma/client");

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

	const season = 6;

	const tierMMR = [
		{ name: "PROSPECT", high: 87, low: 0 },
		{ name: "APPRENTICE", high: 123, low: 87 },
		{ name: "EXPERT", high: 158, low: 123 },
		{ name: "MYTHIC", high: 500, low: 158 },
	];
	const playerMMR = tierMMR.filter((m) => m.name === tier)[0];

	const draftTeams = await Team.getAllActiveByTier(tier);

	const draftPlayers = (await Player.filterAllByStatus([
		LeagueStatus.DRAFT_ELIGIBLE,
		LeagueStatus.FREE_AGENT,
		LeagueStatus.SIGNED,
		LeagueStatus.GENERAL_MANAGER
	])).filter(p => p.Status.leagueStatus === LeagueStatus.GENERAL_MANAGER ? p.Status.contractStatus === ContractStatus.SIGNED : true);


	const tierPlayers = draftPlayers.filter(
		(p) =>
			p.PrimaryRiotAccount?.mmr &&
			p.PrimaryRiotAccount.MMR.mmrEffective < playerMMR.high &&
			p.PrimaryRiotAccount.MMR.mmrEffective >= playerMMR.low
	);
	let amountOfPlayers = tierPlayers.length;
	let teamScore = [];
	let lotteryScore = 0;

	const tierGames = await Games.getAllBy({
		tier: tier,
	});
	let teamWins = [];
	draftTeams.forEach((team) => {
		//const win = tierGames.filter((g) => g.winner === team.id).length;
		const winloss = teamWinLoss.filter((g) => g.id === team.id);
		if (!winloss[0]) {
			const win = 0;
			const loss = 0;
			teamWins.push({ ...team, wins: win, loss: loss });
			// console.log(teamWins);
		} else {
			const win = winloss[0].win;
			const loss = winloss[0].lose;
			teamWins.push({ ...team, wins: win, loss: loss });
			// console.log(teamWins);
		}
	});

	let teamWinPercent = [];
	teamWins.forEach((team) => {
		let winPercent = team.wins / (team.wins + team.loss);
		const teamPostPoints = postPoints.filter((p) => team.id === p.id);

		if (!teamPostPoints[0]) {
			const postPoints = 0;
			if (!winPercent) {
				winPercent = 0;
			}
			// console.log(winPercent);
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
		console.log(`Lottery`)
		console.log(lottery);
		const team = teamLottery[lottery];
		//cut from teams add to snakedTeams
		snakedTeams.push(team);
		teamLottery = teamLottery.filter((t) => t !== team);
	}

	let pick = 1;
	let round = 1;
	for (let i = 1; i <= rounds; i++) {
		if (i % 2) {
			//run the picks in normal order
			for (let j = 0; j < snakedTeams.length; j++) {
				console.log(`Franchise:`, snakedTeams[j].franchise, `Season:`, season, `Pick:`, pick, `round:`, round, tier);
				pick++;
			}
		} else {
			//run picks in reverse order
			for (let l = snakedTeams.length - 1; l >= 0; l--) {
				console.log(`Franchise:`, snakedTeams[l].franchise, `Season:`, season, `Pick:`, pick, `round:`, round, tier);
				pick++;
			}
		}
		round++;
		pick = 1;
		console.log(`-----`)
	}
	//running the remaining picks

	if (remainingPicks != 0) {
		if (rounds / 2 == 1) {
			for (let i = 0; i < remainingPicks; i++) {
				console.log(`Franchise:`, snakedTeams[i].franchise, `Season:`, season, `Pick:`, pick, `round:`, round, tier);
				pick++;
			}
		} else {
			const stopPicks = snakedTeams.length - remainingPicks - 1;
			for (let l = snakedTeams.length - 1; l > stopPicks; l--) {
				console.log(`Franchise:`, snakedTeams[l].franchise, `Season:`, season, `Pick:`, pick, `round:`, round, tier);
				pick++;
			}
		}
		pick = 1;
		console.log(`-----`)
	}

	const teamOrder = [];

	snakedTeams.forEach((team) => {
		teamOrder.push({
			name: team.Franchise.slug,
			value: team.name,
		});
	});
	console.log(teamOrder);

	const embed = new EmbedBuilder({
		author: { name: "VDC Draft Generator" },
		description: `Teams for ${tier} pick in the following order`,
		color: 0xe92929,
		fields: [
			...teamOrder,
			{ name: "Players: ", value: amountOfPlayers, inline: true },
			{ name: "Rounds: ", value: `${Math.ceil(rounds)}`, inline: true },
		],
		footer: { text: `Valorant Draft Circuit - Draft` },
	});

	return await interaction.editReply({ embeds: [embed] });
}
