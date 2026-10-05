const { ChatInputCommandInteraction, channelMention } = require(`discord.js`);
const { CHANNELS } = require(`../../../utils/enums`);
const { generateLottery, awardCompPicks, fulfillFutureTrade, viewTierDraftBoard, setKeeperPick, resetKeeperPick, draftPlayer, releaseOfflineDraftResults, refreshDraftBoardChannel, beginOfflineDraft } = require(`../subcommands/draft`);


module.exports = {

	name: `draft`,

	async execute(/** @type ChatInputCommandInteraction */ interaction) {
		await interaction.deferReply();

		const subcommand = interaction.options.getSubcommand();

		switch (subcommand) {
			case `generate-lottery`: {
				const tier = interaction.options.getString(`tier`);

				return await generateLottery(interaction, tier);
			}
			case `award-comp-picks`: {
				const round = interaction.options.getNumber(`round`);
				const tier = interaction.options.getString(`tier`);
				const franchiseName = interaction.options.getString(`franchise`);

				return await awardCompPicks(interaction, round, tier, franchiseName);
			}
			case `fulfill-future-trade`: {
				const round = interaction.options.getNumber(`round`);
				const tier = interaction.options.getString(`tier`);
				const franchiseFromName = interaction.options.getString(`franchise-from`);
				const franchiseToName = interaction.options.getString(`franchise-to`);

				return await fulfillFutureTrade(interaction, round, tier, franchiseFromName, franchiseToName);
			}
			case `view-draft-board`: {
				const tier = interaction.options.getString(`tier`);

				return await viewTierDraftBoard(interaction, tier);
			}
			case `set-keeper-pick`: {
				const overallPick = interaction.options.getNumber(`overall-pick`);
				const tier = interaction.options.getString(`tier`);
				const discordID = interaction.options.getUser(`user`).id;

				return await setKeeperPick(interaction, overallPick, tier, discordID);
			}
			case `reset-keeper-pick`: {
				const discordID = interaction.options.getUser(`user`).id;

				return await resetKeeperPick(interaction, discordID);
			}
			case `begin-offline-draft`: {
				const tier = interaction.options.getString(`tier`);

				return await beginOfflineDraft(interaction, tier);
			}
			// case `set-timer-state`: {
			// 	const state = _hoistedOptions[0].value;

			// 	return await setTimerState(interaction, state);
			// }
			case `player`: {
				const discordID = interaction.options.getUser(`user`).id;

				return await draftPlayer(interaction, discordID);
			}
			case `release-offline-draft-results`: {
				const tier = interaction.options.getString(`tier`);

				return await releaseOfflineDraftResults(interaction, tier);
			}
			case `refresh-draft-board`: {
				await refreshDraftBoardChannel(interaction);
				return await interaction.editReply(`The ${channelMention(CHANNELS.DRAFT_BOARD)} channel has been updated!`)
			}
		}
	},
};

