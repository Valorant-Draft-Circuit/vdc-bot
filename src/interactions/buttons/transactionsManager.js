const { EmbedBuilder } = require(`discord.js`);
const { cut, sign, draftSign, renew, updateTier, sub, unsub, ir, swap, retire, } = require(`../subcommands/transactions`);

const { TransactionsNavigationOptions } = require(`../../../utils/enums`);

module.exports = {
	id: `transactionsManager`,

	async execute(interaction, args) {
		await interaction.deferReply({ ephemeral: true }); // defer as early as possible

		switch (Number(args)) {
			//  CONFIRM BUTTONS  ###################################
			case TransactionsNavigationOptions.CUT_CONFIRM:
				return await cut.confirm(interaction);
			// case TransactionsSignOptions.CONFIRM:
			// 	return await sign.confirm(interaction);
			// case TransactionsDraftSignOptions.CONFIRM:
			// 	return await draftSign.confirm(interaction);
			// case TransactionsRenewOptions.CONFIRM:
			// 	return await renew.confirm(interaction);
			// case TransactionsUpdateTierOptions.CONFIRM:
			// 	return await updateTier.confirm(interaction);
			// case TransactionsSubTypes.CONFIRM_SUB:
			// 	return await sub.confirm(interaction);
			// case TransactionsSubTypes.CONFIRM_UNSUB:
			// 	return await unsub.confirm(interaction);
			// case TransactionsIROptions.CONFIRM_SET:
			// 	return await ir.confirmSet(interaction);
			// case TransactionsIROptions.CONFIRM_REMOVE:
			// 	return await ir.confirmRemove(interaction);
			// case TransactionsSwapOptions.CONFIRM:
			// 	return await swap.confirm(interaction);
			// case TransactionsRetireOptions.CONFIRM:
			// 	return await retire.confirm(interaction);

			//  CANCEL BUTTONS  ####################################
			case TransactionsNavigationOptions.CANCEL:
				return await cancel(interaction);

			default:
				return await interaction.reply({
					content: `There was an error. ERR: BTN_TSC_MGR`,
				});
		}
	},
};

async function cancel(interaction) {
	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);

	embedEdits.setDescription(`This operation was cancelled.`);
	embedEdits.setFields([]);

	return await interaction.message.edit({
		embeds: [embedEdits],
		components: [],
	});
}
