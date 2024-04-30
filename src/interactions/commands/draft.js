const fs = require("fs");
const { LeagueStatus, ContractStatus, Tier } = require("@prisma/client");

const { Franchise, Player, Team, Games, ControlPanel } = require("../../../prisma");
const { EmbedBuilder, ChatInputCommandInteraction, } = require("discord.js");
const { prisma } = require("../../../prisma/prismadb");
const { CHANNELS } = require("../../../utils/enums");
const { generateLottery, awardCompPicks, fulfillFutureTrade, viewTierDraftBoard, setKeeperPick, resetKeeperPick, draftPlayer, releaseOfflineDraftResults } = require("../subcommands/draft");
const { beginOfflineDraft } = require("../subcommands/draft/draftPlayer");


module.exports = {

	name: `draft`,

	async execute(/** @type ChatInputCommandInteraction */ interaction) {
		await interaction.deferReply();

		const { _subcommand, _hoistedOptions } = interaction.options;

		switch (_subcommand) {
			case `generate-lottery`: {
				const tier = _hoistedOptions[0].value;

				return await generateLottery(interaction, tier);
			}
			case `award-comp-picks`: {
				const round = _hoistedOptions[0].value;
				const tier = _hoistedOptions[1].value;
				const franchiseName = _hoistedOptions[2].value;

				return await awardCompPicks(interaction, round, tier, franchiseName);
			}
			case `fulfill-future-trade`: {
				const round = _hoistedOptions[0].value;
				const tier = _hoistedOptions[1].value;
				const franchiseFromName = _hoistedOptions[2].value;
				const franchiseToName = _hoistedOptions[3].value;

				return await fulfillFutureTrade(interaction, round, tier, franchiseFromName, franchiseToName);
			}
			case `view-draft-board`: {
				const tier = _hoistedOptions[0].value;

				return await viewTierDraftBoard(interaction, tier);
			}
			case `set-keeper-pick`: {
				const overallPick = _hoistedOptions[0].value;
				const tier = _hoistedOptions[1].value;
				const discordID = _hoistedOptions[2].value;

				return await setKeeperPick(interaction, overallPick, tier, discordID);
			}
			case `reset-keeper-pick`: {
				const discordID = _hoistedOptions[0].value;

				return await resetKeeperPick(interaction, discordID);
			}
			case `begin-offline-draft`: {
				const tier = _hoistedOptions[0].value;

				return await beginOfflineDraft(interaction, tier);
			}
			// case `set-timer-state`: {
			// 	const state = _hoistedOptions[0].value;

			// 	return await setTimerState(interaction, state);
			// }
			case `player`: {
				const discordID = _hoistedOptions[0].value;

				return await draftPlayer(interaction, discordID);
			}
			case `release-offline-draft-results`: {
				const tier = _hoistedOptions[0].value;

				return await releaseOfflineDraftResults(interaction, tier);
			}
		}
	},
};

