const { ChatInputCommandInteraction, GuildMember } = require("discord.js");

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} = require("discord.js");

/** Send confirmation to Unsub a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 */

async function requestUnsub(interaction, player) {
  await interaction.deferReply();

  const playerData = await Player.getBy({ discordID: player.id });
  const teamData = await Team.getBy({ id: playerData.team });
  const roster = await Team.getRosterBy({ id: playerData.team });
  const franchiseData = await Franchise.getBy({ id: teamData.franchise });

  // checks
  if (playerData == undefined)
    return await interaction.editReply({
      content: `This player doesn't exist!`,
      ephemeral: false,
    });
  if (playerData.contractStatus !== ContractStatus.ACTIVE_SUB)
    return await interaction.editReply({
      content: `This player is not an active sub!`,
      ephemeral: false,
    });

  // checks
  if (playerData == undefined)
    return await interaction.editReply({
      content: `This player doesn't exist!`,
      ephemeral: false,
    });
  if (
    [
      PlayerStatusCode.FREE_AGENT,
      PlayerStatusCode.RESTRICTED_FREE_AGENT,
    ].includes(player.status)
  )
    return await interaction.editReply({
      content: `This player is not a Free Agent/Restricted Free Agent and cannot be signed to ${teamData.name}!`,
      ephemeral: false,
    });

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
        value: `UNSUB\n${player.user}\n\`${player.id}\`\n${teamData.name}\n${franchiseData.name}`,
        inline: true,
      },
    ],
    footer: { text: `Transactions — Unsub` },
  });

  const cancel = new ButtonBuilder({
    customId: `transactions_${TransactionsSubTypes.CANCEL}`,
    label: `Cancel`,
    style: ButtonStyle.Danger,
  });

  const confirm = new ButtonBuilder({
    customId: `transactions_${TransactionsSubTypes.CONFIRM_UNSUB}`,
    label: `Confirm`,
    style: ButtonStyle.Success,
  });

  // create the action row, add the component to it & then editReply with all the data
  const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
  return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmUnsub(interaction) {
  await interaction.deferReply({ ephemeral: true }); // defer as early as possible

  const data = interaction.message.embeds[0].fields[1].value
    .replaceAll(`\``, ``)
    .split(`\n`);
  const playerID = data[2];

  const playerData = await Player.getBy({ discordID: playerID });
  const playerIGN = await Player.getIGNby({ discordID: playerID });
  const teamData = await Team.getBy({ name: data[3] });
  const franchiseData = await Franchise.getBy({ name: data[4] });

  const playerTag = playerIGN.split(`#`)[0];
  const guildMember = await interaction.guild.members.fetch(playerID);

  // cut the player & ensure that the player's team property is now null
  const player = await Transaction.unsub({ playerID: playerData.id });
  if (player.team !== null)
    return await interaction.editReply({
      content: `There was an error while attempting to unsub the player. The database was not updated.`,
    });

  const embed = interaction.message.embeds[0];
  const embedEdits = new EmbedBuilder(embed);
  embedEdits.setDescription(`This operation was successfully completed.`);
  embedEdits.setFields([]);
  await interaction.message.edit({ embeds: [embedEdits], components: [] });

  // create the base embed
  const announcement = new EmbedBuilder({
    author: { name: `VDC Transactions Manager` },
    description: `${guildMember} (${playerTag})'s temporary contract with ${teamData.name} has ended!`,
    thumbnail: {
      url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}`,
    },
    color: 0xe92929,
    footer: { text: `Transactions — Unsub` },
    timestamp: Date.now(),
  });

  await interaction.deleteReply();
  return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}
module.exports = {
  requestUnsub: requestUnsub,
  confirmUnsub: confirmUnsub,
};
