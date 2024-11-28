const { Franchise, ControlPanel } = require(`../../../../prisma`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { refreshDraftBoardChannel } = require("./refreshDraftBoardChannel");

async function awardCompPicks(interaction, round, tier, franchiseName) {
	// get current season from the database
	const season = await ControlPanel.getSeason();

	// get franchise, it's team in the tier (if it exists) & the filtered draft board
	const franchise = await Franchise.getBy({ name: franchiseName });
	const franchiseTeamInTier = franchise.Teams.find((t) => t.tier === tier);
	const draftBoard = await prisma.draft.findMany({
		where: {
			AND: [{ season: season }, { tier: tier }, { round: round }],
		},
	});

	// checks
	if (franchiseTeamInTier === undefined) return await interaction.editReply(`The franchise \`${franchiseName}\` doesn't have a team in the tier you're trying to award a comp pick for. If you believe this to be an error, please let the tech team know.`);
	if (franchiseTeamInTier.active === false) return await interaction.editReply(`The franchise \`${franchiseName}\` doesn't have an active team in the tier you're trying to award a comp pick for. If you believe this to be an error, please let the tech team know.`);
	if (draftBoard.length === 0) return await interaction.editReply(`There are no picks in the season ${season} ${tier} draft for round ${round}. If you believe this to be an error, please let the tech team know.`);

	// the new comp pick number will be the last pick in the round + 1
	const compPickNumber = draftBoard.pop().pick + 1;

	await prisma.draft.create({
		data: {
			season: season,
			tier: tier,
			round: round,
			pick: compPickNumber,
			franchise: franchise.id,
			keeper: round == 99
		},
	});

	await refreshDraftBoardChannel(interaction);
	return await interaction.editReply(`The round ${round} ${tier} compensation pick has been successfully awarded to ${franchiseName} (${franchise.id}) and the database has been updated.`);
}

module.exports = { awardCompPicks }