const { ChatInputCommandInteraction, GuildMember } = require("discord.js");

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} = require("discord.js");

/** Send confirmation to sign a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 */

async function requestCut(interaction, player) {
  await interaction.deferReply();
  const playerData = await Player.getBy({ discordID: player.value });

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
        value: `CUT\n${player.user}\n\`${player.value}\`\n${team.name}\n${franchise.name}`,
        inline: true,
      },
    ],
    footer: { text: `Transactions — Cut` },
  });

  const cancel = new ButtonBuilder({
    customId: `transactions_${TransactionsCutOptions.CANCEL}`,
    label: `Cancel`,
    style: ButtonStyle.Danger,
  });

  const confirm = new ButtonBuilder({
    customId: `transactions_${TransactionsCutOptions.CONFIRM}`,
    label: `Confirm`,
    style: ButtonStyle.Success,
  });

  // create the action row, add the component to it & then reply with all the data
  const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
  return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmCut(interaction) {
  await interaction.deferReply({ ephemeral: true }); // defer as early as possible

  const playerID = interaction.message.embeds[0].fields[1].value
    .replaceAll(`\``, ``)
    .split(`\n`)[2];

  const playerData = await Player.getInfoBy({ discordID: playerID });
  const playerIGN = await Player.getIGNby({ discordID: playerID });
  const guildMember = await interaction.guild.members.fetch(playerID);

  const playerTag = playerIGN.split(`#`)[0];
  const accolades = guildMember.nickname?.match(emoteregex);

  // remove the franchise role and update their nickname
  if (guildMember._roles.includes(playerData.franchise.roleID))
    await guildMember.roles.remove(playerData.franchise.roleID);
  await guildMember.roles.add(ROLES.LEAGUE.FREE_AGENT);
  guildMember.setNickname(
    `FA | ${playerTag} ${accolades ? accolades.join(``) : ``}`
  );

  // cut the player & ensure that the player's team property is now null
  const player = await Transaction.cut(playerID);
  if (player.team !== null)
    return await interaction.editReply({
      content: `There was an error while attempting to cut the player. The database was not updated.`,
    });

  const embed = interaction.message.embeds[0];
  const embedEdits = new EmbedBuilder(embed);
  embedEdits.setDescription(`This operation was successfully completed.`);
  embedEdits.setFields([]);
  await interaction.message.edit({ embeds: [embedEdits], components: [] });

  // create the base embed
  const announcement = new EmbedBuilder({
    author: { name: `VDC Transactions Manager` },
    description: `${guildMember} (${playerTag}) was cut from ${playerData.franchise.name}`,
    thumbnail: {
      url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${playerData.franchise.logoFileName}`,
    },
    color: 0xe92929,
    fields: [
      {
        name: `Franchise`,
        value: `<${playerData.franchise.emoteID}> ${playerData.franchise.name}`,
        inline: true,
      },
      {
        name: `Team`,
        value: playerData.team.name,
        inline: true,
      },
      /** @TODO Once GM discord IDs are in Franchsie Table, show this block */
      // {
      //     name: `General Manager`,
      //     value: `"\${playerData.franchise.gm}"`,
      //     inline: true
      // }
    ],
    footer: { text: `Transactions — CUT` },
    timestamp: Date.now(),
  });

  await interaction.deleteReply();
  return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

module.exports = {
  requestCut: requestCut,
  confirmCut: confirmCut,
};
