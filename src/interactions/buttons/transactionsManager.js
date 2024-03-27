const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} = require("discord.js");
const {
  sign,
  draftSign,
  cut,
  renew,
  updateTier,
  sub,
  unsub,
  ir,
  swap,
  retire,
} = require("../subcommands/transactions/index");
const {
  CHANNELS,
  ROLES,
  TransactionsSubTypes,
  TransactionsCutOptions,
  TransactionsIROptions,
  TransactionsSignOptions,
  TransactionsDraftSignOptions,
  TransactionsRenewOptions,
  ContractStatus,
  TransactionsUpdateTierOptions,
  TransactionsSwapOptions,
  TransactionsRetireOptions,
  PlayerStatusCode,
} = require(`../../../utils/enums`);

const { Franchise, Team, Transaction, Player } = require(`../../../prisma`);

const emoteregex =
  /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

let transactionsAnnouncementChannel;

module.exports = {
  id: `transactionsManager`,

  async execute(interaction, args) {
    transactionsAnnouncementChannel = await interaction.guild.channels.fetch(
      CHANNELS.TRANSACTIONS
    );

    switch (Number(args)) {
      //  CONFIRM BUTTONS  ###################################
      case TransactionsSignOptions.CONFIRM:
        return await sign.confirm(interaction);
      case TransactionsDraftSignOptions.CONFIRM:
        return await draftSign.confirm(interaction);
      case TransactionsCutOptions.CONFIRM:
        return await cut.confirm(interaction);
      case TransactionsRenewOptions.CONFIRM:
        return await renew.confirm(interaction);
      case TransactionsUpdateTierOptions.CONFIRM:
        return await updateTier.confirm(interaction);
      case TransactionsSubTypes.CONFIRM_SUB:
        return await sub.confirm(interaction);
      case TransactionsSubTypes.CONFIRM_UNSUB:
        return await unsub.confirm(interaction);
      case TransactionsIROptions.CONFIRM_SET:
        return await ir.confirmSet(interaction);
      case TransactionsIROptions.CONFIRM_REMOVE:
        return await ir.confirmRemove(interaction);
      case TransactionsSwapOptions.CONFIRM:
        return await swap.confirm(interaction);
      case TransactionsRetireOptions.CONFIRM:
        return await retire.confirm(interaction);

      //  CANCEL BUTTONS  ####################################
      case TransactionsSignOptions.CANCEL:
      case TransactionsDraftSignOptions.CANCEL:
      case TransactionsCutOptions.CANCEL:
      case TransactionsRenewOptions.CANCEL:
      case TransactionsUpdateTierOptions.CANCEL:
      case TransactionsSubTypes.CANCEL:
      case TransactionsIROptions.CANCEL:
      case TransactionsSwapOptions.CANCEL:
      case TransactionsRetireOptions.CANCEL:
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
