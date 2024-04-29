const fs = require("fs");
const { LeagueStatus, ContractStatus, Tier } = require("@prisma/client");

const { Franchise, Player, Team, Games, ControlPanel } = require("../../../../prisma");
const { EmbedBuilder, ChatInputCommandInteraction, } = require("discord.js");
const { prisma } = require("../../../../prisma/prismadb");
const { CHANNELS } = require("../../../../utils/enums");

async function viewTierDraftBoard(interaction, tier) {
	// get current season from the database
	const currentSeasonResponse = await prisma.controlPanel.findFirst({
		where: { name: `current_season` },
	});
	const season = Number(currentSeasonResponse.value);

	// check to make sure the draft hasn't already been generated for this season
	const draftDoneCheck = await prisma.draft.findMany({ where: { AND: [{ season: season }, { tier: tier }] } });
	if (draftDoneCheck.length === 0) return await interaction.editReply(`The ${tier} draft lottery for season ${season} has not happened yet, and so there is nothing to display.`);

	// get the draft board for the season and tier
	const draftBoard = await prisma.draft.findMany({
		where: { AND: [{ season: season }, { tier: tier }] },
		include: { Franchise: true, Player: { include: { PrimaryRiotAccount: true } } },
	});

	// sort the draft board to organize by rounds and picks
	const sortedDraftBoard = draftBoard
		.sort((a, b) => a.pick - b.pick)
		.sort((a, b) => a.round - b.round);


	// generate a line for each pick and format for display
	let lRound = 0;
	let overallPickNumber = 1;
	const output = sortedDraftBoard.map((sdb) => {
		let strArr = [];
		if (sdb.round == lRound + 1) {
			strArr.push(`\n  ` + `Round  ${sdb.round} `.padEnd(90, `-`) + ` \n\n`);
			lRound++;
		}
		if (sdb.round == 99 && lRound != 99) {
			strArr.push(`\n  ` + `Keeper Round  `.padEnd(90, `-`) + ` \n\n`);
			lRound = 99;
		}
		strArr.push(
			// `T: ${sdb.tier}  | ` +     // REMOVING TIER FROM EACH LINE & ADDING TO TOP OF FILE
			(sdb.round !== 99 ?
				`R: ${String(sdb.round).padEnd(2, ` `)}  |  ` :
				`R: ` + `K`.padEnd(2, ` `) + `  |  `) +
			`P: ${String(sdb.pick).padEnd(2, ` `)}  |  ` +
			`O: ${String(overallPickNumber).padEnd(3, ` `)}  |  ` +
			`K: ${String(sdb.keeper).padEnd(5, ` `)}  |  ` +
			`F: ${sdb.Franchise.name.padEnd(25, ` `)} ` +
			`${sdb.Player ? `  |  U: ${sdb.Player.PrimaryRiotAccount.riotIGN} (${sdb.Player.name})` : ``}`
		);
		overallPickNumber++
		return strArr.join(``);
	});

	// write (or overwrite) the draft board file and send it
	fs.writeFileSync(`./cache/draft_board_${tier}.js`, `${tier} Draft Board\n` + output.join(`\n`));
	return await interaction.editReply({ content: `The ${tier} tier's draft board is attached!`, files: [`./cache/draft_board_${tier}.js`], });
}

module.exports = { viewTierDraftBoard }
