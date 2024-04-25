const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require(`discord.js`);
const { ChatInputCommandInteraction, ButtonInteraction, StringSelectMenuInteraction, GuildMember } = require(`discord.js`);


const { Franchise, Player } = require(`../../../../prisma`);
const { prisma } = require("../../../../prisma/prismadb");
const { CHANNELS, TransactionsNavigationOptions } = require(`../../../../utils/enums`);
const { Tier } = require("@prisma/client");

let notAllowedOperation = false;

// this is needed to correctly sort the tiers
const tierSortWeights = {
	PROSPECT: 1,
	APPRENTICE: 2,
	EXPERT: 3,
	MYTHIC: 4
}

/** Initiate a trade
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 */
async function requestTrade(interaction, franchise1Name, franchise2Name) {
	if (franchise1Name === franchise2Name) return await interaction.editReply(`cannot be the same!`);

	// create the action row, add the component to it & then reply with all the data
	return await interaction.editReply({
		embeds: [await createFreshEmbed(franchise1Name, franchise2Name)],
		components: [
			await createFranchiseNavigationButtons(franchise1Name, franchise2Name),
			await createFinalizationButtons()
		]
	});
}

/** Display the select menu for the players and draft picks a franchise owns
 * @param {ButtonInteraction} interaction 
 * @param {1|2} franchiseSelection 
 * @param {`PLAYER`|`DRAFT_PICK`} type 
 */
async function displayFranchiseTradeOptions(interaction, franchiseSelection, type) {
	// get the message embed
	const embedData = interaction.message.embeds[0];

	const franchiseNames = embedData.description.replace(`Below is a summary of the trade to be executed between `, ``).split(` & `);
	const franchise1Name = franchiseNames[0];
	const franchise2Name = franchiseNames[1];

	const selectedFranchise = franchiseSelection == 1 ? franchiseNames[0] : franchiseNames[1];

	// edit the message with the navigation options & delete the "<Application> is thinking..." reply
	await interaction.message.edit({
		components: [
			await createFranchiseNavigationButtons(franchise1Name, franchise2Name),
			...(await createSelectMenuSelections(interaction, franchiseSelection, selectedFranchise, type)),
			await createFinalizationButtons(),
		]
	});
	return await interaction.deleteReply();
}

async function resetTrade(/** @type ButtonInteraction */ interaction) {
	// get the message embed to destructure franchise names
	const embedData = interaction.message.embeds[0];

	const franchiseNames = embedData.description.replace(`Below is a summary of the trade to be executed between `, ``).split(` & `);
	const franchise1Name = franchiseNames[0];
	const franchise2Name = franchiseNames[1];

	// create the action row, add the component to it & then reply with all the data
	await interaction.message.edit({
		embeds: [await createFreshEmbed(franchise1Name, franchise2Name)],
		components: [
			await createFranchiseNavigationButtons(franchise1Name, franchise2Name),
			await createFinalizationButtons()
		]
	});
	return await interaction.deleteReply();
}

async function confirmTrade(/** @type ButtonInteraction */ interaction) {
	await interaction.deleteReply();
	const embedData = interaction.message.embeds[0];

	const franchiseNames = embedData.description.replace(`Below is a summary of the trade to be executed between `, ``).split(` & `);
	const franchise1Name = franchiseNames[0];
	const franchise2Name = franchiseNames[1];
	const franchise1 = await Franchise.getBy({ name: franchise1Name });
	const franchise2 = await Franchise.getBy({ name: franchise2Name });
	// get the message embed

	const franchise1Gives = await getFranchiseTradeParamaters(embedData, 1);
	const franchise2Gives = await getFranchiseTradeParamaters(embedData, 2);

	// filter by franchise & plavers vs trades
	const f1PlayerOffers = franchise1Gives.filter(f1g => f1g.type == `PLAYER`);
	const f2PlayerOffers = franchise2Gives.filter(f2g => f2g.type == `PLAYER`);
	const f1DraftPickOffers = franchise1Gives.filter(f1g => f1g.type == `DRAFT_PICK`);
	const f2DraftPickOffers = franchise2Gives.filter(f2g => f2g.type == `DRAFT_PICK`);

	// validate player trades and exit if trades are invalid
	const f1ValidatedPlayerTrade = await validatePlayerTrade(interaction, f1PlayerOffers, franchise2)
	const f2ValidatedPlayerTrade = await validatePlayerTrade(interaction, f2PlayerOffers, franchise1);

	if (f1ValidatedPlayerTrade.includes(false) || f2ValidatedPlayerTrade.includes(false)) return await interaction.channel.send(`See the errors above. Please reset the trade manager and try again.`);

	if (f1DraftPickOffers.length > 0) await executeDraftPickTrade(f1DraftPickOffers, franchise2);
	if (f2DraftPickOffers.length > 0) await executeDraftPickTrade(f2DraftPickOffers, franchise1);
	if (f1PlayerOffers.length > 0) await executePlayerTrade(f1PlayerOffers, franchise2);
	if (f2PlayerOffers.length > 0) await executePlayerTrade(f2PlayerOffers, franchise1);

	const embedEdits = new EmbedBuilder(embedData);
	embedEdits.setDescription(`This operation was successfully completed.`);
	embedEdits.setFields([]);
	await interaction.message.edit({ embeds: [embedEdits], components: [] });

	const f1PA = f1PlayerOffers.map(fp => `\`U\` | [\`${fp.riotIGN}\`](${fp.trackerURL}) - ${fp.name}`)
	const f1DPA = f1DraftPickOffers.map(fdp => `\`P\` | \`${fdp.tier}\` - Round ${fdp.round}, Pick ${fdp.pick}, (${fdp.overallPick})`);
	const f1Gives = [...f1PA, ...f1DPA];

	const f2PA = f2PlayerOffers.map(fp => `\`U\` | [\`${fp.riotIGN}\`](${fp.trackerURL}) - ${fp.name}`)
	const f2DPA = f2DraftPickOffers.map(fdp => `\`P\` | \`${fdp.tier}\` - Round ${fdp.round}, Pick ${fdp.pick}, (${fdp.overallPick})`);
	const f2Gives = [...f2PA, ...f2DPA];

	// create the base embed
	const announcement = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `${franchise1Name} & ${franchise2Name} have agreed to a trade!`,
		color: 0xe92929,
		fields: [
			{
				name: `\u200B`,
				value: `**${franchise1Name}** trades away:`,
				inline: true,
			},
			{
				name: `\u200B`,
				value: `**${franchise2Name}** trades away:`,
				inline: true,
			},
			{ name: `\t`, value: `\t` },
			{ name: `\u200B`, value: f1Gives.join(`\n`), inline: true, },
			{ name: `\u200B`, value: f2Gives.join(`\n`), inline: true, },
		],
		footer: { text: `Transactions — Trade` },
		timestamp: Date.now(),
	});

	const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
	return await transactionsChannel.send({ embeds: [announcement] });
}

async function playerTradeRequest(/** @type StringSelectMenuInteraction */ interaction, franchiseSelection, playerIDArr) {
	const playersToTrade = await prisma.user.findMany({
		where: { OR: playerIDArr.map(playerID => { return { id: playerID } }) },
		include: { Accounts: true, PrimaryRiotAccount: true }
	});

	// get the message embed
	const embedData = interaction.message.embeds[0];
	const embedDataArchive = JSON.parse(JSON.stringify(interaction.message.embeds[0]));

	const franchiseNames = embedData.description.replace(`Below is a summary of the trade to be executed between `, ``).split(` & `);
	const franchise1Name = franchiseNames[0];
	const franchise2Name = franchiseNames[1];

	const selectedFranchise = franchiseSelection == 1 ? franchise1Name : franchise2Name;
	const fieldToModify = franchiseSelection == 1 ? 3 : 4;

	const existingDataInRequest = embedData.fields[fieldToModify].value
		.split(`\n`).filter(s => s !== ``);

	const playerDataUpdate = playersToTrade.map(p => {
		const playerData = {
			riotIGN: p.PrimaryRiotAccount.riotIGN,
			name: p.name,
			// discordID: p.Accounts.find(a => a.provider === `discord`).providerAccountId,
			trackerURL: `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(p.PrimaryRiotAccount.riotIGN)}`
		}

		return `\`U\` | [\`${playerData.riotIGN}\`](${playerData.trackerURL}) - ${playerData.name}`
	});

	// sort and update the array
	const mergedDataArray = [...playerDataUpdate, ...existingDataInRequest];
	const sortedPlayerArray = mergedDataArray
		.filter(edr => edr.includes(`\`U\``))
		.filter(s => s !== ``);
	const sortedDraftPickArray = mergedDataArray
		.filter(edr => edr.includes(`\`P\``))
		.map(fdr => {
			const tier = fdr.split(`\``)[3];
			const rpArr = fdr.match(/\d+/g);
			return {
				tier: tier,
				round: rpArr[0],
				pick: rpArr[1]
			};
		})
		.sort((a, b) => a.pick - b.pick)
		.sort((a, b) => a.round - b.round)
		.sort((a, b) => tierSortWeights[a.tier] - tierSortWeights[b.tier])
		.map(dp => `${dp.tier} | Round: ${dp.round}, Pick: ${dp.pick}`);

	const updatedDataArray = [...sortedPlayerArray, ...sortedDraftPickArray]
	embedData.fields[fieldToModify].value = updatedDataArray.join(`\n`);

	const components = [
		await createFranchiseNavigationButtons(franchise1Name, franchise2Name),
		...(await createSelectMenuSelections(interaction, franchiseSelection, selectedFranchise, `PLAYER`)),
		await createFinalizationButtons(),
	];

	// create the new embed and send it
	const embed = new EmbedBuilder(notAllowedOperation ? embedDataArchive : embedData);
	notAllowedOperation = false;
	return await interaction.message.edit({
		embeds: [embed], components: components
	});
}

async function draftPickTradeRequest(/** @type StringSelectMenuInteraction */ interaction, franchiseSelection, draftPickIDArr) {
	const draftPicksToTrade = await prisma.draft.findMany({
		where: { OR: draftPickIDArr.map(draftPickID => { return { id: Number(draftPickID) } }) }
	});

	// get the message embed
	const embedData = interaction.message.embeds[0];

	const franchiseNames = embedData.description.replace(`Below is a summary of the trade to be executed between `, ``).split(` & `);
	const franchise1Name = franchiseNames[0];
	const franchise2Name = franchiseNames[1];

	const selectedFranchise = franchiseSelection == 1 ? franchise1Name : franchise2Name;
	const fieldToModify = franchiseSelection == 1 ? 3 : 4;

	const existingDataInRequest = embedData.fields[fieldToModify].value
		.split(`\n`).filter(s => s !== ``);

	const playerDataUpdate = draftPicksToTrade.map(p => {
		return `\`P\` | \`${p.tier}\` - Round ${p.round}, Pick ${p.pick}`
	});

	const currentSeasonResponse = await prisma.controlPanel.findFirst({
		where: { name: `current_season` },
	});
	const season = Number(currentSeasonResponse.value);

	// get draft board for the season & sort it
	const draftBoard = (await prisma.draft.findMany({ where: { season: season } }))
		.sort((a, b) => a.pick - b.pick)
		.sort((a, b) => a.round - b.round)
		.sort((a, b) => tierSortWeights[a.tier] - tierSortWeights[b.tier]);

	// sort and update the array
	const mergedDataArray = [...playerDataUpdate, ...existingDataInRequest];
	const sortedPlayerArray = mergedDataArray
		.filter(edr => edr.includes(`\`U\``))
		.filter(s => s !== ``);
	const sortedDraftPickArray = mergedDataArray
		.filter(edr => edr.includes(`\`P\``))
		.map(fdr => {
			const tier = fdr.split(`\``)[3];
			const rpArr = fdr.match(/\d+/g);
			const pick = draftBoard.find(db => db.tier === tier && db.round === Number(rpArr[0]) && db.pick === Number(rpArr[1]));
			const overallPickNumber = draftBoard.filter(db => db.tier === tier).indexOf(pick) + 1;
			return {
				tier: tier,
				round: rpArr[0],
				pick: rpArr[1],
				overallPick: overallPickNumber
			};
		})
		.sort((a, b) => a.pick - b.pick)
		.sort((a, b) => a.round - b.round)
		.sort((a, b) => tierSortWeights[a.tier] - tierSortWeights[b.tier])
		.map(dp => `\`P\` | \`${dp.tier}\` - Round ${dp.round}, Pick ${dp.pick}, (${dp.overallPick})`);
	// console.log(sortedDraftPickArray)
	const updatedDataArray = [...sortedPlayerArray, ...sortedDraftPickArray]
	embedData.fields[fieldToModify].value = updatedDataArray.join(`\n`);

	// create the new embed and send it
	const embed = new EmbedBuilder(embedData);
	return await interaction.message.edit({
		embeds: [embed], components: [
			await createFranchiseNavigationButtons(franchise1Name, franchise2Name),
			...(await createSelectMenuSelections(interaction, franchiseSelection, selectedFranchise, `DRAFT_PICK`)),
			await createFinalizationButtons(),
		]
	});
}

module.exports = {
	requestTrade: requestTrade,
	resetTrade: resetTrade,
	confirmTrade: confirmTrade,
	displayFranchiseTradeOptions: displayFranchiseTradeOptions,

	playerTradeRequest: playerTradeRequest,
	draftPickTradeRequest: draftPickTradeRequest,
};

// HELPER FUNCTIONS ##########################################################################
// ###########################################################################################

async function createFreshEmbed(franchise1Name, franchise2Name) {
	return new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `Below is a summary of the trade to be executed between ${franchise1Name} & ${franchise2Name}`,
		color: 0xe92929,
		fields: [
			{
				name: `\u200B`,
				value: `**${franchise1Name}** will trade away the following:`,
				inline: true,
			},
			{
				name: `\u200B`,
				value: `**${franchise2Name}** will trade away the following:`,
				inline: true,
			},
			{ name: `\t`, value: `\t` },
			{ name: `\u200B`, value: ``, inline: true, },
			{ name: `\u200B`, value: ``, inline: true, },
		],
		footer: { text: `Transactions — Trade` },
	});
}

async function createFranchiseNavigationButtons(franchise1Name, franchise2Name) {

	// check if the draft pick trade button needs to be disabled (will be inverted because if trades can be picked, button SHOULD NOT be disabled)
	const draftPickTradesOpen = await prisma.controlPanel.findFirst({
		where: { name: `draft_trades_open` },
	});
	const draftPickTradesOpenResponse = Boolean(draftPickTradesOpen.value);

	// get franchises
	const franchise1 = await Franchise.getBy({ name: franchise1Name });
	const franchise2 = await Franchise.getBy({ name: franchise2Name });

	const f1PlayersButton = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.TRADE_F1P}`,
		label: `${franchise1.slug} Players`,
		style: ButtonStyle.Secondary,
	});
	const f1DraftPicksButton = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.TRADE_F1DP}`,
		label: `${franchise1.slug} Draft Picks`,
		style: ButtonStyle.Secondary,
		disabled: !draftPickTradesOpenResponse
	});
	const middleDisabled = new ButtonBuilder({
		customId: `disabled`,
		label: `🔄`,
		style: ButtonStyle.Secondary,
		disabled: true
	});
	const f2PlayersButton = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.TRADE_F2P}`,
		label: `${franchise2.slug} Players`,
		style: ButtonStyle.Secondary,
	});
	const f2DraftPicksButton = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.TRADE_F2DP}`,
		label: `${franchise2.slug} Draft Picks`,
		style: ButtonStyle.Secondary,
		disabled: !draftPickTradesOpenResponse
	});

	const franchisePossessionSelector = new ActionRowBuilder({ components: [f1PlayersButton, f1DraftPicksButton, middleDisabled, f2PlayersButton, f2DraftPicksButton] });

	return franchisePossessionSelector;
}

/**
 * @param {String} franchiseName Name of the franchise
 * @param {`PLAYER`|`DRAFT_PICK`} type Type of select menu(s) to generate
 */
async function createSelectMenuSelections(interaction, franchiseSelection, franchiseName, type) {
	const selectMenuArray = [];
	const embedData = interaction.message.embeds[0];
	const fieldToModify = franchiseSelection == 1 ? 3 : 4;
	const existingDataInRequest = embedData.fields[fieldToModify].value.split(`\n`);


	if (type === `PLAYER`) { // create the select menu for players
		// get all players in the franchise
		const franchisePlayers = await prisma.user.findMany({
			where: { Team: { Franchise: { name: franchiseName } } },
			include: { PrimaryRiotAccount: true }
		});

		// get the message embed to filter out players who are already a part of the trade transaction
		const filteredDataInRequest = existingDataInRequest.filter(s => s !== ``).map(l => l.split(` - `)[1]);

		// map those players to the proper format
		let franchisePlayersSelectMenuOutput = franchisePlayers.map(fp => {
			return {
				label: `${fp.PrimaryRiotAccount.riotIGN} - ${fp.name}`,
				value: String(fp.id)
			}
		}).filter(p => !filteredDataInRequest.includes(p.label.split(` - `)[1]));

		if (franchisePlayersSelectMenuOutput.length == 0) {
			await interaction.channel.send(`A franchise cannot trade it's last signed player away. Please reset the trade manager and try again.`);
			notAllowedOperation = true;
			return await interaction.message.components.slice(1, interaction.message.components.length - 1);
		};
		// logic to split >25 options into 2 select menus
		if (franchisePlayersSelectMenuOutput.length < 25) {
			const selectMenu = new StringSelectMenuBuilder({
				customId: `transactionsTrade_F${franchiseSelection}_P0`,
				placeholder: `${franchiseName} Players`,
				maxValues: franchisePlayersSelectMenuOutput.length,
				options: franchisePlayersSelectMenuOutput
			});

			selectMenuArray.push(selectMenu);

		} else {

			// create array[2] of options split into opt[25] & opt[n-25]
			const optionsArray = [
				franchisePlayersSelectMenuOutput.slice(0, 25),
				franchisePlayersSelectMenuOutput.slice(25)
			];

			// and their corresponding select menus
			const selectMenu1 = new StringSelectMenuBuilder({
				customId: `transactionsTrade_F${franchiseSelection}_P1`,
				placeholder: `${franchiseName} Players`,
				maxValues: 25,
				options: optionsArray[0]
			});
			const selectMenu2 = new StringSelectMenuBuilder({
				customId: `transactionsTrade_F${franchiseSelection}_P2`,
				placeholder: `${franchiseName} Players`,
				maxValues: optionsArray[1].length,
				options: optionsArray[1]
			});

			// and then push them into the array
			selectMenuArray.push(selectMenu1);
			selectMenuArray.push(selectMenu2);
		}

	} else { // create the select menu for draft picks
		// get the current season
		const currentSeasonResponse = await prisma.controlPanel.findFirst({
			where: { name: `current_season` },
		});
		const season = Number(currentSeasonResponse.value);

		const filteredDataInRequest = existingDataInRequest.filter(edr => edr.includes(`\`P\``)).map(fdr => {
			const tier = fdr.split(`\``)[3];
			const rpArr = fdr.match(/\d+/g);
			return {
				tier: tier,
				round: rpArr[0],
				pick: rpArr[1]
			};
		});
		// get all draft picks the franchise owns for the season
		const franchiseDraftPicks = (await prisma.draft.findMany({
			where: { AND: [{ Franchise: { name: franchiseName } }, { season: season }] }
		}))
			.sort((a, b) => a.pick - b.pick)
			.sort((a, b) => a.round - b.round)
			.sort((a, b) => tierSortWeights[a.tier] - tierSortWeights[b.tier]);

		// filter away the keeper round
		const franchiseDraftPicksSelectMenuOutput = franchiseDraftPicks
			.filter(fdp => !fdp.keeper) // ignore picks that have keepers in them already
			.map(fdp => {
				return {
					label: `${fdp.tier} | Round: ${fdp.round}, Pick: ${fdp.pick}`,
					value: String(fdp.id)
				}
			})
			.filter(dp => !dp.label.includes(`99`))
			.filter(p => {
				return !filteredDataInRequest.map(fdr => `${fdr.tier} | Round: ${fdr.round}, Pick: ${fdr.pick}`).includes(p.label)
			});

		if (franchiseDraftPicksSelectMenuOutput.length == 0) {
			await interaction.channel.send(`A franchise cannot trade it's last draft pick away. Please reset the trade manager and try again.`);
			notAllowedOperation = true;
			return await interaction.message.components.slice(1, interaction.message.components.length - 1);
		};
		// logic to split >25 options into 2 select menus
		if (franchiseDraftPicksSelectMenuOutput.length < 25) {
			const selectMenu = new StringSelectMenuBuilder({
				customId: `transactionsTrade_F${franchiseSelection}_DP0`,
				placeholder: `${franchiseName} Draft Picks`,
				maxValues: franchiseDraftPicksSelectMenuOutput.length,
				options: franchiseDraftPicksSelectMenuOutput
			});
			selectMenuArray.push(selectMenu);

		} else {

			// create array[2] of options split into opt[25] & opt[n-25]
			const optionsArray = [
				franchiseDraftPicksSelectMenuOutput.slice(0, 25),
				franchiseDraftPicksSelectMenuOutput.slice(25)
			];

			// and their corresponding select menus
			const selectMenu1 = new StringSelectMenuBuilder({
				customId: `transactionsTrade_F${franchiseSelection}_DP1`,
				placeholder: `${franchiseName} Draft Picks`,
				maxValues: 25,
				options: optionsArray[0]
			});
			const selectMenu2 = new StringSelectMenuBuilder({
				customId: `transactionsTrade_F${franchiseSelection}_DP2`,
				placeholder: `${franchiseName} Draft Picks`,
				maxValues: optionsArray[1].length,
				options: optionsArray[1]
			});

			// and then push them into the array
			selectMenuArray.push(selectMenu1);
			selectMenuArray.push(selectMenu2);
		}
	}

	// send the action rows off
	const actionRows = selectMenuArray.map(sma => new ActionRowBuilder({ components: [sma] }));
	return actionRows;
}

async function createFinalizationButtons() {
	const cancel = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.CANCEL}`,
		label: `Cancel`,
		style: ButtonStyle.Danger,
	});

	const reset = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.TRADE_RESET}`,
		label: `Reset`,
		style: ButtonStyle.Secondary,
	});

	const confirm = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.TRADE_CONFIRM}`,
		label: `Confirm`,
		style: ButtonStyle.Success,
	});

	const subrow = new ActionRowBuilder({ components: [cancel, reset, confirm] });
	return subrow;
}

async function getFranchiseTradeParamaters(embed, franchiseSelection) {
	const fieldToGet = franchiseSelection == 1 ? 3 : 4;

	const requestData = embed.fields[fieldToGet].value
		.split(`\n`).filter(s => s !== ``);

	// sort and update the array
	// const mergedDataArray = [...playerDataUpdate, ...requestData];
	const filteredPlayerArray = requestData
		.filter(edr => edr.includes(`\`U\``))
		.filter(s => s !== ``)
		.map(spr => {
			const ign = spr.match(/(?<= \| \[\`)(.+)(?=`\]\(https:)/)[0];
			const username = spr.match(/(?<= - )(.+)/)[0];
			return {
				type: `PLAYER`,
				name: username,
				riotIGN: ign,
				trackerURL: `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ign)}`
			}
		});

	const currentSeasonResponse = await prisma.controlPanel.findFirst({
		where: { name: `current_season` },
	});
	const season = Number(currentSeasonResponse.value);

	// get draft board for the season & sort it
	const draftBoard = (await prisma.draft.findMany({ where: { season: season } }))
		.sort((a, b) => a.pick - b.pick)
		.sort((a, b) => a.round - b.round)
		.sort((a, b) => tierSortWeights[a.tier] - tierSortWeights[b.tier]);
	const filteredDraftPickArray = requestData
		.filter(edr => edr.includes(`\`P\``))
		.map(fdr => {
			// console.log(fdr)
			const tier = fdr.split(`\``)[3];
			const rpArr = fdr.match(/\d+/g);
			const pick = draftBoard.find(db => db.tier === tier && db.round === Number(rpArr[0]) && db.pick === Number(rpArr[1]));
			const overallPickNumber = draftBoard.filter(db => db.tier === tier).indexOf(pick) + 1;

			return {
				type: `DRAFT_PICK`,
				tier: tier,
				round: rpArr[0],
				pick: rpArr[1],
				overallPick: overallPickNumber
			};
		});

	const parsedDataArray = [...filteredPlayerArray, ...filteredDraftPickArray]
	return parsedDataArray;
}

async function validatePlayerTrade(interaction, playerArray, franchiseToRecieve) {
	if (playerArray.length === 0) return [true];

	const franchiseTeamsToRecieve = franchiseToRecieve.Teams;

	const playerDataArray = await prisma.user.findMany({
		where: { OR: playerArray.map(player => { return { name: player.name } }) },
		include: { Accounts: true, PrimaryRiotAccount: { include: { MMR: true } } }
	});

	// get MMR tier lines from the database
	const mmrCapResponse = await prisma.controlPanel.findMany({ where: { name: { contains: `mmr_cap_player` } }, });
	const prospectMMRCap = mmrCapResponse.find((r) => r.name === `prospect_mmr_cap_player`).value;
	const apprenticeMMRCap = mmrCapResponse.find((r) => r.name === `apprentice_mmr_cap_player`).value;
	const expertMMRCap = mmrCapResponse.find((r) => r.name === `expert_mmr_cap_player`).value;

	// store all MMR bounds in array and grab the relevant MMR bounds to store in tierMMR
	const tierMMRBounds = [
		{ name: Tier.PROSPECT, high: prospectMMRCap, low: 0 },
		{ name: Tier.APPRENTICE, high: apprenticeMMRCap, low: prospectMMRCap },
		{ name: Tier.EXPERT, high: expertMMRCap, low: apprenticeMMRCap },
		{ name: Tier.MYTHIC, high: 999, low: expertMMRCap },
	];

	const playerTierArr = playerDataArray.map((pdr) => {
		const effectiveMMR = pdr.PrimaryRiotAccount.MMR.mmrEffective;
		const playerTier = tierMMRBounds.find((m) => effectiveMMR >= m.low && effectiveMMR < m.high).name;
		const findValidTeam = franchiseTeamsToRecieve.find(t => t.tier == playerTier && t.active == true);

		const returnObject = {
			id: pdr.id,
			name: pdr.name,
			riotIGN: pdr.PrimaryRiotAccount.riotIGN,
			tier: playerTier,
			mmr: pdr.PrimaryRiotAccount.MMR,
			validTeam: findValidTeam == undefined ? false : true
		}

		if (!returnObject.validTeam) interaction.channel.send(`${franchiseToRecieve.name} doesn't have an active ${returnObject.tier} team for ${returnObject.riotIGN} (${returnObject.name})`)

		return returnObject;
	});

	return playerTierArr.map(pa => pa.validTeam);
}

async function executeDraftPickTrade(draftPicks, recievingFranchise) {
	// console.log(draftPicks)
	const processForPrisma = draftPicks.map(dp => {
		return {
			AND: [
				{ tier: dp.tier },
				{ round: Number(dp.round) },
				{ pick: Number(dp.pick) },
			]
		}
	});

	return await prisma.draft.updateMany({
		where: {
			OR: processForPrisma
		},
		data: { franchise: recievingFranchise.id }
	});
}

async function executePlayerTrade(players, recievingFranchise) {
	const franchiseTeamsToRecieve = recievingFranchise.Teams;

	const playerDataArray = await prisma.user.findMany({
		where: { OR: players.map(player => { return { name: player.name } }) },
		include: { Accounts: true, PrimaryRiotAccount: { include: { MMR: true } } }
	});

	// get MMR tier lines from the database
	const mmrCapResponse = await prisma.controlPanel.findMany({ where: { name: { contains: `mmr_cap_player` } }, });
	const prospectMMRCap = mmrCapResponse.find((r) => r.name === `prospect_mmr_cap_player`).value;
	const apprenticeMMRCap = mmrCapResponse.find((r) => r.name === `apprentice_mmr_cap_player`).value;
	const expertMMRCap = mmrCapResponse.find((r) => r.name === `expert_mmr_cap_player`).value;

	// store all MMR bounds in array and grab the relevant MMR bounds to store in tierMMR
	const tierMMRBounds = [
		{ name: Tier.PROSPECT, high: prospectMMRCap, low: 0 },
		{ name: Tier.APPRENTICE, high: apprenticeMMRCap, low: prospectMMRCap },
		{ name: Tier.EXPERT, high: expertMMRCap, low: apprenticeMMRCap },
		{ name: Tier.MYTHIC, high: 999, low: expertMMRCap },
	];

	const playersToUpdateArray = playerDataArray.map((pdr) => {
		const effectiveMMR = pdr.PrimaryRiotAccount.MMR.mmrEffective;
		const playerTier = tierMMRBounds.find((m) => effectiveMMR >= m.low && effectiveMMR < m.high).name;
		const findValidTeam = franchiseTeamsToRecieve.find(t => t.tier == playerTier && t.active == true);

		const returnObject = {
			id: pdr.id,
			name: pdr.name,
			riotIGN: pdr.PrimaryRiotAccount.riotIGN,
			tier: playerTier,
			mmr: pdr.PrimaryRiotAccount.MMR,
			validTeam: findValidTeam
		}
		return returnObject;
	});


	for (let i = 0; i < playersToUpdateArray.length; i++) {
		const playerToUpdate = playersToUpdateArray[i];
		if (playerToUpdate == undefined) return;
		const player = await Player.getBy({ ign: playerToUpdate.riotIGN })
		await prisma.user.update({
			where: { id: player.id },
			data: { team: playerToUpdate.validTeam.id }
		});
	}

	return;
}