const { ChatInputCommandInteraction, GuildMember } = require("discord.js");

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} = require("discord.js");

/** Send confirmation to Renew a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 * @param {String} teamName
 */

async function requestRenew(interaction, player, teamName) {
  // get all info
  const playerData = await Player.getBy({ discordID: player.value });
  const teamData = await Team.getBy({ name: teamName });
  const franchiseData = await Franchise.getBy({ id: teamData.franchise });

  // checks
  if (playerData == undefined)
    return interaction.reply({
      content: `This player doesn't exist!`,
      ephemeral: false,
    });
  if (playerData.status !== PlayerStatusCode.SIGNED)
    return interaction.reply({
      content: `This player is not signed and cannot have their contract renewed!`,
      ephemeral: false,
    });
  if (playerData.team !== teamData.id)
    return interaction.reply({
      content: `This player is not on ${franchiseData.name}'s ${teamData.tier} team (${franchiseData.slug} | ${teamName}) and cannot have their contract renewed!`,
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
        value: `RENEW\n${player.user}\n\`${player.value}\`\n${teamData.name}\n${franchiseData.name}`,
        inline: true,
      },
    ],
    footer: { text: `Transactions — Renew` },
  });

  const cancel = new ButtonBuilder({
    customId: `transactions_${TransactionsRenewOptions.CANCEL}`,
    label: `Cancel`,
    style: ButtonStyle.Danger,
    // emoji: `❌`,
  });

  const confirm = new ButtonBuilder({
    customId: `transactions_${TransactionsRenewOptions.CONFIRM}`,
    label: `Confirm`,
    style: ButtonStyle.Success,
    // emoji: `✔`,
  });

  // create the action row, add the component to it & then reply with all the data
  const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
  interaction.reply({ embeds: [embed], components: [subrow] });
}

async function confirmRenew(interaction) {
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
  const player = await Transaction.renew({ playerID: playerData.id });
  if (
    player.team !== teamData.id ||
    player.contractStatus !== ContractStatus.RENEWED
  )
    return await interaction.editReply({
      content: `There was an error while attempting to renew the player's contract. The database was not updated.`,
    });

  const embed = interaction.message.embeds[0];
  const embedEdits = new EmbedBuilder(embed);
  embedEdits.setDescription(`This operation was successfully completed.`);
  embedEdits.setFields([]);
  await interaction.message.edit({ embeds: [embedEdits], components: [] });

  // create the base embed
  const announcement = new EmbedBuilder({
    author: { name: `VDC Transactions Manager` },
    description: `${guildMember} (${playerTag})'s contract was renewed by ${franchiseData.name}`,
    thumbnail: {
      url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}`,
    },
    color: 0xe92929,
    fields: [
      {
        name: `Franchise`,
        value: `<${franchiseData.emoteID}> ${franchiseData.name}`,
        inline: true,
      },
      {
        name: `Team`,
        value: teamData.name,
        inline: true,
      },
      /** @TODO Once GM discord IDs are in Franchsie Table, show this block */
      // {
      //     name: `General Manager`,
      //     value: `"\${franchiseData.gm}"`,
      //     inline: true
      // }
    ],
    footer: { text: `Transactions — Renew` },
    timestamp: Date.now(),
  });

  await interaction.deleteReply();
  return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}
module.exports = {
  requestRenew: requestRenew,
  confirmRenew: confirmRenew,
};
