const { ChatInputCommandInteraction, GuildMember } = require("discord.js");

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} = require("discord.js");

/** Send confirmation to IR a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 */

async function requestIR(interaction, player) {
  await interaction.deferReply();

  const playerData = await Player.getBy({ discordID: player.id });

  // checks
  if (playerData == undefined)
    return await interaction.editReply({
      content: `This player doesn't exist!`,
      ephemeral: false,
    });
  if (playerData.team === null)
    return await interaction.editReply({
      content: `This player is not on a team and cannot be placed on Inactive Reserve!`,
      ephemeral: false,
    });

  if (playerData.contractStatus === ContractStatus.INACTIVE_RESERVE) {
    const teamData = await Team.getBy({ id: playerData.team });
    const franchiseData = await Franchise.getBy({ id: teamData.franchise });

    // create the base embed
    const embed = new EmbedBuilder({
      author: { name: `VDC Transactions Manager` },
      description: `Are you sure you perform the following action?`,
      color: 0xe92929,
      fields: [
        {
          name: `\u200B`,
          value: `**Transaction**\n\`  Player Tag: \`\n\`   Player ID: \`\n\`        Team: \`\n\`   Franchise: \``,
          inline: true,
        },
        {
          name: `\u200B`,
          value: `REMOVE IR\n${player.user}\n\`${player.id}\`\n${teamData.name}\n${franchiseData.name}`,
          inline: true,
        },
      ],
      footer: { text: `Transactions — Inactive Reserve` },
    });

    const cancel = new ButtonBuilder({
      customId: `transactions_${TransactionsIROptions.CANCEL}`,
      label: `Cancel`,
      style: ButtonStyle.Danger,
      // emoji: `❌`,
    });

    const confirm = new ButtonBuilder({
      customId: `transactions_${TransactionsIROptions.CONFIRM_REMOVE}`,
      label: `Confirm`,
      style: ButtonStyle.Success,
      // emoji: `✔`,
    });

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
    return await interaction.editReply({
      embeds: [embed],
      components: [subrow],
    });
  } else if (playerData.status === PlayerStatusCode.SIGNED) {
    const teamData = await Team.getBy({ id: playerData.team });
    const franchiseData = await Franchise.getBy({ id: teamData.franchise });

    // create the base embed
    const embed = new EmbedBuilder({
      author: { name: `VDC Transactions Manager` },
      description: `Are you sure you perform the following action?`,
      color: 0xe92929,
      fields: [
        {
          name: `\u200B`,
          value: `**Transaction**\n\`  Player Tag: \`\n\`   Player ID: \`\n\`        Team: \`\n\`   Franchise: \``,
          inline: true,
        },
        {
          name: `\u200B`,
          value: `PLACE IR\n${player.user}\n\`${player.id}\`\n${teamData.name}\n${franchiseData.name}`,
          inline: true,
        },
      ],
      footer: { text: `Transactions — Inactive Reserve` },
    });

    const cancel = new ButtonBuilder({
      customId: `transactions_${TransactionsIROptions.CANCEL}`,
      label: `Cancel`,
      style: ButtonStyle.Danger,
      // emoji: `❌`,
    });

    const confirm = new ButtonBuilder({
      customId: `transactions_${TransactionsIROptions.CONFIRM_SET}`,
      label: `Confirm`,
      style: ButtonStyle.Success,
      // emoji: `✔`,
    });

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
    return await interaction.editReply({
      embeds: [embed],
      components: [subrow],
    });
  } else
    return await interaction.editReply({
      content: `This player is not signed to a franchise and cannot be placed on Inactive Reserve!`,
      ephemeral: false,
    });
}

async function confirmSetIR(interaction) {
  await interaction.deferReply({ ephemeral: true }); // defer as early as possible

  const data = interaction.message.embeds[0].fields[1].value
    .replaceAll(`\``, ``)
    .split(`\n`);
  const playerID = data[2];

  const playerData = await Player.getBy({ discordID: playerID });
  const playerIGN = await Player.getIGNby({ discordID: playerID });
  const franchiseData = await Franchise.getBy({ name: data[4] });

  const playerTag = playerIGN.split(`#`)[0];
  const guildMember = await interaction.guild.members.fetch(playerID);

  if (!guildMember._roles.includes(ROLES.LEAGUE.INACTIVE_RESERVE))
    await guildMember.roles.add(ROLES.LEAGUE.INACTIVE_RESERVE);

  // cut the player & ensure that the player's team property is now null
  const player = await Transaction.toggleInactiveReserve({
    playerID: playerData.id,
    toggle: `SET`,
  });
  if (player.contractStatus !== ContractStatus.INACTIVE_RESERVE)
    return await interaction.editReply({
      content: `There was an error while attempting to place the player on Inactive Reserve. The database was not updated.`,
    });

  const embed = interaction.message.embeds[0];
  const embedEdits = new EmbedBuilder(embed);
  embedEdits.setDescription(`This operation was successfully completed.`);
  embedEdits.setFields([]);
  await interaction.message.edit({ embeds: [embedEdits], components: [] });

  // create the base embed
  const announcement = new EmbedBuilder({
    author: { name: `VDC Transactions Manager` },
    description: `${guildMember} (${playerTag}) has been placed on Inactive Reserve`,
    thumbnail: {
      url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}`,
    },
    color: 0xe92929,
    footer: { text: `Transactions — Inactive Reserve` },
    timestamp: Date.now(),
  });

  await interaction.deleteReply();
  return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}
async function confirmRemoveIR(interaction) {
  await interaction.deferReply({ ephemeral: true }); // defer as early as possible

  const data = interaction.message.embeds[0].fields[1].value
    .replaceAll(`\``, ``)
    .split(`\n`);
  const playerID = data[2];

  const playerData = await Player.getBy({ discordID: playerID });
  const playerIGN = await Player.getIGNby({ discordID: playerID });
  const franchiseData = await Franchise.getBy({ name: data[4] });

  const playerTag = playerIGN.split(`#`)[0];
  const guildMember = await interaction.guild.members.fetch(playerID);

  if (guildMember._roles.includes(ROLES.LEAGUE.INACTIVE_RESERVE))
    await guildMember.roles.remove(ROLES.LEAGUE.INACTIVE_RESERVE);

  // cut the player & ensure that the player's team property is now null
  const player = await Transaction.toggleInactiveReserve({
    playerID: playerData.id,
    toggle: `REMOVE`,
  });
  if (player.contractStatus === ContractStatus.INACTIVE_RESERVE)
    return await interaction.editReply({
      content: `There was an error while attempting to remove the player from Inactive Reserve. The database was not updated.`,
    });

  const embed = interaction.message.embeds[0];
  const embedEdits = new EmbedBuilder(embed);
  embedEdits.setDescription(`This operation was successfully completed.`);
  embedEdits.setFields([]);
  await interaction.message.edit({ embeds: [embedEdits], components: [] });

  // create the base embed
  const announcement = new EmbedBuilder({
    author: { name: `VDC Transactions Manager` },
    description: `${guildMember} (${playerTag}) is no longer on Inactive Reserve`,
    thumbnail: {
      url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}`,
    },
    color: 0xe92929,
    footer: { text: `Transactions — Inactive Reserve` },
    timestamp: Date.now(),
  });

  await interaction.deleteReply();
  return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}
module.exports = {
  requestIR: requestIR,
  confirmSetIR: confirmSetIR,
  confirmRemoveIR: confirmRemoveIR,
};
