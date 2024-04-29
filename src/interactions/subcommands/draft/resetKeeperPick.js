const fs = require("fs");
const { LeagueStatus, ContractStatus, Tier } = require("@prisma/client");

const { Franchise, Player, Team, Games, ControlPanel } = require("../../../../prisma");
const { EmbedBuilder, ChatInputCommandInteraction, } = require("discord.js");
const { prisma } = require("../../../../prisma/prismadb");
const { CHANNELS } = require("../../../../utils/enums");

async function resetKeeperPick(interaction, discordID) {
	// get current season from the database
	const currentSeasonResponse = await prisma.controlPanel.findFirst({
		where: { name: `current_season` },
	});
	const season = Number(currentSeasonResponse.value);

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

	if (updatedPick.userID !== null) return await interaction.editReply(`There was an error. The database was not updated`);
	else return await interaction.editReply(`${player.PrimaryRiotAccount.riotIGN} (${player.name}) has been removed from the R:${keeperSearch.round}, P:${keeperSearch.pick} keeper slot.`);
}

module.exports = { resetKeeperPick }
