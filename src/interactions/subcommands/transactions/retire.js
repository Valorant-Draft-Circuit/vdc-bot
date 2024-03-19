const { ChatInputCommandInteraction, GuildMember } = require("discord.js");

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} = require("discord.js");

/** Send confirmation to Retire a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 */

async function requestRetire(interaction, player) {
  await interaction.deferReply();
  const playerData = await Player.getBy({ discordID: player.id });

  // checks
  if (playerData == undefined)
    return interaction.editReply({
      content: `This player doesn't exist!`,
      ephemeral: false,
    });
  if (playerData.team == null)
    return interaction.editReply({
      content: `This player is not on a team!`,
      ephemeral: false,
    });

  const franchise = await Franchise.getBy({ teamID: playerData.team });
  const team = await Team.getBy({ id: playerData.team });

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
        value: `RETIRE\n${player.user}\n\`${player.id}\`\n${team.name}\n${franchise.name}`,
        inline: true,
      },
    ],
    footer: { text: `Transactions — Retire` },
  });

  const cancel = new ButtonBuilder({
    customId: `transactions_${TransactionsRetireOptions.CANCEL}`,
    label: `Cancel`,
    style: ButtonStyle.Danger,
  });

  const confirm = new ButtonBuilder({
    customId: `transactions_${TransactionsRetireOptions.CONFIRM}`,
    label: `Confirm`,
    style: ButtonStyle.Success,
  });

  // create the action row, add the component to it & then reply with all the data
  const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
  return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmRetire(interaction) {
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
  const accolades = guildMember.nickname?.match(emoteregex);

  // remove the franchise role and update their nickname
  if (guildMember._roles.includes(franchiseData.roleID))
    await guildMember.roles.remove(franchiseData.roleID);
  await guildMember.roles.add(ROLES.LEAGUE.FORMER_PLAYER);
  guildMember.setNickname(
    `${playerTag} ${accolades ? accolades.join(``) : ``}`
  );

  const retiredPlayer = await Transaction.retire(playerID);
  if (
    retiredPlayer.team !== null &&
    retiredPlayer.status !== PlayerStatusCode.FORMER_PLAYER &&
    retiredPlayer.contractStatus !== ContractStatus.RETIRED
  )
    return await interaction.editReply({
      content: `There was an error while attempting to retire the player. The database was not updated.`,
    });

  const embed = interaction.message.embeds[0];
  const embedEdits = new EmbedBuilder(embed);
  embedEdits.setDescription(`This operation was successfully completed.`);
  embedEdits.setFields([]);
  await interaction.message.edit({ embeds: [embedEdits], components: [] });

  // create the base embed
  const announcement = new EmbedBuilder({
    author: { name: `VDC Transactions Manager` },
    description: `${guildMember} (${playerTag}) is retiring from the league`,
    color: 0xe92929,
    footer: { text: `Transactions — Retire` },
    timestamp: Date.now(),
  });

  await interaction.deleteReply();
  return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}
module.exports = {
  requestRetire: requestRetire,
  confirmRetire: confirmRetire,
};
