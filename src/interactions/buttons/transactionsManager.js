const { EmbedBuilder, ChatInputCommandInteraction } = require(`discord.js`);
const { cut, sign, draftSign, renew, updateTier, sub, unsub, ir, retire, trade, captain } = require(`../subcommands/transactions`);

const { TransactionsNavigationOptions } = require(`../../../utils/enums`);

module.exports = {
	id: `transactionsManager`,

	async execute(/** @type ChatInputCommandInteraction */ interaction, args) {
		await interaction.deferReply({ ephemeral: true }); // defer as early as possible

		switch (Number(args)) {
			//  CONFIRM BUTTONS  ###################################
			case TransactionsNavigationOptions.CUT_CONFIRM:
				return await cut.confirm(interaction);
			case TransactionsNavigationOptions.SIGN_COMFIRM:
				return await sign.confirm(interaction);
			// case TransactionsDraftSignOptions.CONFIRM:
			// 	return await draftSign.confirm(interaction);
			case TransactionsNavigationOptions.RENEW_COMFIRM:
				return await renew.confirm(interaction);
			case TransactionsNavigationOptions.UPDATE_TIER_COMFIRM:
				return await updateTier.confirm(interaction);
			// case TransactionsSubTypes.CONFIRM_SUB:
			// 	return await sub.confirm(interaction);
			// case TransactionsSubTypes.CONFIRM_UNSUB:
			// 	return await unsub.confirm(interaction);
			case TransactionsNavigationOptions.RETIRE_COMFIRM:
				return await retire.confirm(interaction);

			//  IR BUTTONS  ########################################
			case TransactionsNavigationOptions.IR_SET_COMFIRM:
				return await ir.confirm(interaction, `SET`);
			case TransactionsNavigationOptions.IR_REMOVE_COMFIRM:
				return await ir.confirm(interaction, `REMOVE`);

			//  CAPTAIN BUTTONS  ###################################
			case TransactionsNavigationOptions.CAPTAIN_SET_COMFIRM:
				return await captain.confirm(interaction, `SET`);
			case TransactionsNavigationOptions.CAPTAIN_REMOVE_COMFIRM:
				return await captain.confirm(interaction, `REMOVE`);

			//  TRADE BUTTONS  #####################################
			case TransactionsNavigationOptions.TRADE_RESET:
				return await trade.reset(interaction);
			case TransactionsNavigationOptions.TRADE_F1P:
				return await trade.displayFranchiseTradeOptions(interaction, 1, `PLAYER`);
			case TransactionsNavigationOptions.TRADE_F1DP:
				return await trade.displayFranchiseTradeOptions(interaction, 1, `DRAFT_PICK`);
			case TransactionsNavigationOptions.TRADE_F2P:
				return await trade.displayFranchiseTradeOptions(interaction, 2, `PLAYER`);
			case TransactionsNavigationOptions.TRADE_F2DP:
				return await trade.displayFranchiseTradeOptions(interaction, 2, `DRAFT_PICK`);
			case TransactionsNavigationOptions.TRADE_CONFIRM:
				return await trade.confirm(interaction);


			//  CANCEL BUTTONS  ####################################
			case TransactionsNavigationOptions.CANCEL:
				return await cancel(interaction);

			default:
				return await interaction.editReply({
					content: `There was an error. ERR: BTN_TSC_MGR`,
				});
		}
	},
};

async function cancel(/** @type ChatInputCommandInteraction */ interaction) {
	// delete the reply and then edit the original embed to show cancellation confirmation
	await interaction.deleteReply();

	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);

	embedEdits.setDescription(`This operation was cancelled.`);
	embedEdits.setFields([]);

	return await interaction.message.edit({
		embeds: [embedEdits],
		components: [],
	});
}
