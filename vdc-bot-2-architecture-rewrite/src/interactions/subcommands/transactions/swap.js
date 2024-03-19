const { ChatInputCommandInteraction, GuildMember } = require("discord.js");

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} = require("discord.js");

/** Send confirmation to Swap a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} cutPlayer
 * @param {GuildMember} signPlayer
 */

async function requestSwap(interaction, cutPlayer, signPlayer) {
  await interaction.deferReply();

  const cutPlayerData = await Player.getBy({ discordID: cutPlayer.id });
  const signPlayerData = await Player.getBy({ discordID: signPlayer.id });

  // checks
  if (cutPlayerData == undefined)
    return interaction.editReply({
      content: `The player you're trying to cut doesn't exist!`,
      ephemeral: false,
    });
  if (signPlayerData == undefined)
    return interaction.editReply({
      content: `The player you're trying to sign doesn't exist!`,
      ephemeral: false,
    });
  if (
    cutPlayerData.team == null ||
    cutPlayerData.status !== PlayerStatusCode.SIGNED
  )
    return interaction.editReply({
      content: `The player you're trying to cut isn't signed or on a team!`,
      ephemeral: false,
    });
  if (signPlayerData.team !== null)
    return interaction.editReply({
      content: `The player you're trying to sign is already on a team! Use the trade command instead!`,
      ephemeral: false,
    });

  const teamData = await Team.getBy({ id: cutPlayerData.team });
  const franchiseData = await Franchise.getBy({ id: teamData.franchise });

  // create the base embed
  const embed = new EmbedBuilder({
    author: { name: `VDC Transactions Manager` },
    description: `Are you sure you perform the following action?`,
    color: 0xe92929,
    fields: [
      {
        name: `\u200B`,
        value: `**Transaction**\n\`  Cut Player Tag: \`\n\`   Cut Player ID: \`\n\` Sign Player Tag: \`\n\`  Sign Player ID: \`\n\`            Team: \`\n\`       Franchise: \``,
        inline: true,
      },
      {
        name: `\u200B`,
        value: `SWAP\n${cutPlayer.user}\n\`${cutPlayer.id}\`\n${signPlayer.user}\n\`${signPlayer.id}\`\n${teamData.name}\n${franchiseData.name}`,
        inline: true,
      },
    ],
    footer: { text: `Transactions — Swap` },
  });

  const cancel = new ButtonBuilder({
    customId: `transactions_${TransactionsSwapOptions.CANCEL}`,
    label: `Cancel`,
    style: ButtonStyle.Danger,
    // emoji: `❌`,
  });

  const confirm = new ButtonBuilder({
    customId: `transactions_${TransactionsSwapOptions.CONFIRM}`,
    label: `Confirm`,
    style: ButtonStyle.Success,
    // emoji: `✔`,
  });

  // create the action row, add the component to it & then reply with all the data
  const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
  return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmSwap(interaction) {
  await interaction.deferReply({ ephemeral: true }); // defer as early as possible

  const data = interaction.message.embeds[0].fields[1].value
    .replaceAll(`\``, ``)
    .split(`\n`);
  const cutPlayerID = data[2];
  const signPlayerID = data[4];

  const cutPlayerIGN = await Player.getIGNby({ discordID: cutPlayerID });
  const signPlayerIGN = await Player.getIGNby({ discordID: signPlayerID });
  const teamData = await Team.getBy({ name: data[5] });
  const franchiseData = await Franchise.getBy({ name: data[6] });

  const cutPlayerTag = cutPlayerIGN.split(`#`)[0];
  const cutGuildMember = await interaction.guild.members.fetch(cutPlayerID);
  const signPlayerTag = signPlayerIGN.split(`#`)[0];
  const signGuildMember = await interaction.guild.members.fetch(signPlayerID);

  // change roles for cut player
  if (cutGuildMember._roles.includes(franchiseData.roleID))
    await cutGuildMember.roles.remove(franchiseData.roleID);
  await cutGuildMember.roles.add(ROLES.LEAGUE.FREE_AGENT);

  // update nickname for cut player
  const cutAccolades = cutGuildMember.nickname?.match(emoteregex);
  cutGuildMember.setNickname(
    `FA | ${cutPlayerTag} ${cutAccolades ? cutAccolades.join(``) : ``}`
  );

  // change roles for signed player
  if (!signGuildMember._roles.includes(franchiseData.roleID))
    await signGuildMember.roles.add(franchiseData.roleID);
  if (signGuildMember._roles.includes(ROLES.LEAGUE.FREE_AGENT))
    await signGuildMember.roles.remove(ROLES.LEAGUE.FREE_AGENT);
  if (signGuildMember._roles.includes(ROLES.LEAGUE.RESTRICTED_FREE_AGENT))
    await signGuildMember.roles.remove(ROLES.LEAGUE.RESTRICTED_FREE_AGENT);

  // update nickname for signed player
  const signAccolades = signGuildMember.nickname?.match(emoteregex);
  signGuildMember.setNickname(
    `${franchiseData.slug} | ${signPlayerTag} ${
      signAccolades ? signAccolades.join(``) : ``
    }`
  );

  // cut the player & ensure that the player's team property is now null
  const cutPlayer = await Transaction.cut(cutPlayerID);
  if (cutPlayer.team !== null)
    return await interaction.editReply({
      content: `There was an error while attempting to cut the player. The database was not updated.`,
    });
  const signPlayer = await Transaction.sign({
    playerID: signPlayerID,
    teamID: teamData.id,
  });
  if (signPlayer.team !== teamData.id)
    return await interaction.editReply({
      content: `There was an error while attempting to sign the player. The database was not updated.`,
    });

  const embed = interaction.message.embeds[0];
  const embedEdits = new EmbedBuilder(embed);
  embedEdits.setDescription(`This operation was successfully completed.`);
  embedEdits.setFields([]);
  await interaction.message.edit({ embeds: [embedEdits], components: [] });

  // create the base embed
  const announcement = new EmbedBuilder({
    author: { name: `VDC Transactions Manager` },
    description: `${teamData.name} has decided to swap ${cutGuildMember} (${cutPlayerTag})\nfor ${signGuildMember} (${signPlayerTag})`,
    thumbnail: {
      url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}`,
    },
    color: 0xe92929,
    footer: { text: `Transactions — Swap` },
    timestamp: Date.now(),
  });

  await interaction.deleteReply();
  return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}
module.exports = {
  requestSwap: requestSwap,
  confirmSwap: confirmSwap,
};
