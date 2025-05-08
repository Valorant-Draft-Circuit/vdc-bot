const { Franchise, ControlPanel } = require(`../../../../prisma`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { refreshDraftBoardChannel } = require("./refreshDraftBoardChannel");
const { ROLES } = require("../../../../utils/enums");

async function fulfillFutureTrade(interaction, round, tier, franchiseFromName, franchiseToName) {
	const userRoles = interaction.member._roles;
	if (!userRoles.includes(ROLES.OPERATIONS.ADMIN)) return await interaction.reply({ content: `You don't have the Admin role and cannot use this command!` });

	if (franchiseFromName === franchiseToName) return await interaction.editReply(`A franchise cannot give a future trade to themselves!`);

	// get current season from the database
	const season = await ControlPanel.getSeason();

	// get franchise, it's team in the tier (if it exists) & the filtered draft board
	const franchiseFrom = await Franchise.getBy({ name: franchiseFromName });
	const franchiseTo = await Franchise.getBy({ name: franchiseToName });

	const franchiseFromTeamInTier = franchiseFrom.Teams.find((t) => t.tier === tier);
	const franchiseToTeamInTier = franchiseTo.Teams.find((t) => t.tier === tier);
	const draftBoard = await prisma.draft.findMany({
		where: { AND: [{ season: season }, { tier: tier }, { round: round }], },
	});

	// team exists check
	if (franchiseFromTeamInTier === undefined) return await interaction.editReply(`The franchise \`${franchiseFromName}\` doesn't have a team in the tier you're trying to trade a future pick from. If you believe this to be an error, please let the tech team know.`);
	if (franchiseToTeamInTier === undefined) return await interaction.editReply(`The franchise \`${franchiseToName}\` doesn't have a team in the tier you're trying to trade a future pick to. If you believe this to be an error, please let the tech team know.`);

	// active team in tier check
	if (franchiseFromTeamInTier.active === false) return await interaction.editReply(`The franchise \`${franchiseFromName}\` doesn't have an active team in the tier you're trying to trade a future pick from. If you believe this to be an error, please let the tech team know.`);
	if (franchiseToTeamInTier.active === false) return await interaction.editReply(`The franchise \`${franchiseToName}\` doesn't have an active team in the tier you're trying to trade a future pick to. If you believe this to be an error, please let the tech team know.`);

	// round exists check
	if (draftBoard.length === 0) return await interaction.editReply(`There are no picks in the season ${season} ${tier} draft for round ${round}. If you believe this to be an error, please let the tech team know.`);

	const tradedPick = draftBoard.find((db) => db.franchise === franchiseFrom.id);

	// player in pick exists
	if (tradedPick.userID !== null) return await interaction.editReply(`This pick (R: ${tradedPick.round}, pick ${tradedPick.round}) already has a player in this pick`);

	// console.log(`Pick being GIVEN`);
	// console.log(tradedPick);

	// console.log(`${franchiseFromName} (${franchiseFrom.id}) gives R:${tradedPick.round}, P:${tradedPick.pick} to ${franchiseToName} (${franchiseTo.id})`);

	const updatedPick = await prisma.draft.update({
		where: { id: tradedPick.id }, data: { franchise: franchiseTo.id },
	});

	if (updatedPick.franchise !== franchiseTo.id) return await interaction.editReply(`There was an error. The database was not updated`);
	else {
		await refreshDraftBoardChannel(interaction);
		return await interaction.editReply(`${franchiseFromName} (${franchiseFrom.id}) gives R:${tradedPick.round}, P:${tradedPick.pick} to ${franchiseToName} (${franchiseTo.id}). The database has been updated`);
	}
}


module.exports = { fulfillFutureTrade }
