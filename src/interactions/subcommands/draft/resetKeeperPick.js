const { Player, ControlPanel } = require(`../../../../prisma`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { refreshDraftBoardChannel } = require("./refreshDraftBoardChannel");
const { ROLES } = require("../../../../utils/enums");

async function resetKeeperPick(interaction, discordID) {

	const userRoles = interaction.member._roles;
	if (!userRoles.includes(ROLES.OPERATIONS.ADMIN)) return await interaction.reply({ content: `You don't have the Admin role and cannot use this command!` });

	// get current season from the database
	const season = await ControlPanel.getSeason();

	const player = await Player.getBy({ discordID: discordID });
	if (player === null) return await interaction.editReply(`This player doesn't exist!`);

	// pull the draft board to determine if the player is already set as a keeper pick
	const draftBoard = await prisma.draft.findMany({
		where: { AND: [{ season: season }] },
		include: { Player: true },
	});
	if (draftBoard.length === 0) return await interaction.editReply(`The ${player.Team.tier} draft lottery for season ${season} has not happened yet, and so there is nothing to display.`);

	const keeperSearch = draftBoard.find((db) => db.Player?.id === player.id);
	if (keeperSearch === undefined) return await interaction.editReply(`This player is not currently set as a keeper pick anywhere in the season ${season} draft.`);

	// update the draft board with the franchise's keeper pick
	// Round 99 is the base keeper round and ergo, those cannot be traded or changed from being keeper picks
	const data = keeperSearch.round == 99 ? { userID: null } : { userID: null, keeper: false };
	const updatedPick = await prisma.draft.update({
		where: { id: keeperSearch.id },
		data: data,
		include: { Franchise: true, Player: { include: { PrimaryRiotAccount: true } } },
	});

	logger.log(`VERBOSE`, `<@${discordID}> (\`${player.PrimaryRiotAccount.riotIGN}\`, \`${player.name}\`) has been removed as \`${updatedPick.Franchise.name}\`'s keeper pick`)
	if (updatedPick.userID !== null) return await interaction.editReply(`There was an error. The database was not updated`);
	else {
		await refreshDraftBoardChannel(interaction);
		return await interaction.editReply(`<@${discordID}> (\`${player.PrimaryRiotAccount.riotIGN}\`, \`${player.name}\`) has been removed from the R: \`${keeperSearch.round}\`, P: \`${keeperSearch.pick}\` keeper slot.`);
	}
}

module.exports = { resetKeeperPick }
