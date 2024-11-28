const fs = require(`fs`);

const { ControlPanel } = require(`../../../../prisma`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { refreshDraftBoardChannel } = require("./refreshDraftBoardChannel");

async function viewTierDraftBoard(interaction, tier) {
	// get current season from the database
	const season = await ControlPanel.getSeason();

	// check to make sure the draft hasn't already been generated for this season
	const draftDoneCheck = await prisma.draft.findMany({ where: { AND: [{ season: season }, { tier: tier }] } });
	if (draftDoneCheck.length === 0) return await interaction.editReply(`The ${tier} draft lottery for season ${season} has not happened yet, and so there is nothing to display.`);

	await refreshDraftBoardChannel(interaction);
	return await interaction.editReply({ content: `The ${tier} tier's draft board is attached!`, files: [`./bin/draftboard_${tier}.png`], });
}

module.exports = { viewTierDraftBoard }
