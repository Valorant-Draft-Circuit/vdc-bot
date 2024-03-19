function trade(interaction) {
  // create the base embed
  const embed = new EmbedBuilder({
    author: { name: `VDC Transactions Manager` },
    description: `Welcome to the Transactions Trade UI.`,
    thumbnail: {
      url: `https://cdn.discordapp.com/banners/963274331251671071/57044c6a68be1065a21963ee7e697f80.webp?size=480`,
    },
    color: 0xe92929,
    footer: { text: `Transactions — Trade` },
  });

  // create the string select menu for a user to select a franchise & then add the franchises
  const selectMenu = new StringSelectMenuBuilder({
    customId: `transactions_${TransactionsSubTypes.FRANCHISE}`,
    placeholder: "Select a franchise...",
    maxValues: 1,
  });

  // franchises.forEach((franchise) => {
  //     selectMenu.addOptions({
  //         label: franchise.name,
  //         value: franchise.slug,
  //         description: `${franchise.slug} — ${franchise.name}`,
  //         emoji: FranchiseEmote[franchise.slug]
  //     });
  // });

  // create the action row, add the component to it & then reply with all the data
  const subrow = new ActionRowBuilder();
  subrow.addComponents(selectMenu);

  // interaction.reply({ embeds: [embed], components: [subrow] });
  interaction.reply({ embeds: [embed] });
}
