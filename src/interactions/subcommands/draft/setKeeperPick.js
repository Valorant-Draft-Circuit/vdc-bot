const { Player, ControlPanel } = require(`../../../../prisma`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { refreshDraftBoardChannel } = require("./refreshDraftBoardChannel");
const { ROLES } = require("../../../../utils/enums");

async function setKeeperPick(interaction, overallPickNumber, tier, discordID) {

	const userRoles = interaction.member._roles;
	if (!userRoles.includes(ROLES.OPERATIONS.ADMIN)) return await interaction.editReply({ content: `You don't have the Admin role and cannot use this command!` });

	// get current season from the database
	const season = await ControlPanel.getSeason();

	const player = await Player.getBy({ discordID: discordID });

	if (player === null) return await interaction.editReply(`This player doesn't exist!`);
	if (player.PrimaryRiotAccount.MMR === null) return await interaction.editReply(`This player doesn't have an MMR!`);

	// pull the draft board to determine if the player is already set as a keeper pick
	const draftBoard = (await prisma.draft.findMany({
		where: { AND: [{ season: season }, { tier: tier }], },
		include: { Player: true, Franchise: true },
	}))
		.sort((a, b) => a.pick - b.pick)
		.sort((a, b) => a.round - b.round);

	const keeperSearch = draftBoard.find((db) => db.Player?.id === player.id);
	if (keeperSearch !== undefined) return await interaction.editReply(`This player is already set as a keeper pick (R:${keeperSearch.round}, P:${keeperSearch.pick})`);

	const pick = draftBoard[overallPickNumber - 1];

	// checks
	if (pick === null) return await interaction.editReply(`That pick doesn't exist`);
	if (pick.Player !== null) return await interaction.editReply(`That pick already has a player in that slot!`);
	if (player.Team === null) return await interaction.editReply(`That player isn't signed to a franchise and cannot be a keeper pick.`);
	if (player.Team.Franchise.id !== pick.franchise) return await interaction.editReply(`The franchise \`${player.Team.Franchise.name}\` doesn't own the round ${pick.round}, pick ${pick.pick} (overall pick: ${overallPickNumber}) in the ${tier} tier. The franchise that currently owns this draft pick is \`${pick.Franchise.name}\``);

	// update the draft board with the franchise's keeper pick
	const updatedPick = await prisma.draft.update({
		where: { id: pick.id },
		data: { userID: player.id, keeper: true },
		include: { Franchise: true, Player: { include: { PrimaryRiotAccount: true } } },
	});

	logger.log(`VERBOSE`, `<@${discordID}> (\`${player.PrimaryRiotAccount.riotIGN}\`, \`${player.name}\`) has been set as \`${updatedPick.Franchise.name}\`'s keeper pick`)
	if (updatedPick.userID !== player.id) return await interaction.editReply(`There was an error. The database was not updated`);
	else {
		await refreshDraftBoardChannel(interaction);
		return await interaction.editReply(`<@${discordID}> (\`${player.PrimaryRiotAccount.riotIGN}\`, \`${player.name}\`) has been set as \`${updatedPick.Franchise.name}\`'s keeper pick for round \`${pick.round}\`, pick \`${pick.pick}\` (overall pick: \`${overallPickNumber}\`)`)
	};
}

module.exports = { setKeeperPick }
