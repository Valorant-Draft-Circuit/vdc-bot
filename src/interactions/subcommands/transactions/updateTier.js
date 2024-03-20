const { ChatInputCommandInteraction, GuildMember } = require("discord.js");

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} = require("discord.js");

/** Send confirmation to updateTier a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} guildMember
 * @param {String} newTier
 */

async function requestUpdateTier(interaction, guildMember, newTier) {
  await interaction.deferReply();
  const player = await Player.getBy({ discordID: guildMember.id });

  // checks
  if (player == undefined)
    return await interaction.editReply({
      content: `This player doesn't exist!`,
      ephemeral: false,
    });
  if (player.status !== PlayerStatusCode.SIGNED)
    return await interaction.editReply({
      content: `This player is not signed to a franchise and therefore cannot be promoted/demoted!`,
      ephemeral: false,
    });

  const franchise = await Franchise.getBy({ teamID: player.team });
  const franchiseTeams = await Franchise.getTeams({ id: franchise.id });
  const team = await Team.getBy({ id: player.team });

  // ensure that the player isn't being updaeted to the same team and that the franchise has an active team in the tier the player is being promotes/demoted to
  if (team.tier === newTier)
    return await interaction.editReply({
      content: `This player is already in the tier you're trying to promote/demote them to (${newTier})`,
      ephemeral: false,
    });
  if (!franchiseTeams.map((t) => t.tier).includes(newTier))
    return await interaction.editReply({
      content: `${franchise.name} does not have an active team in the ${newTier} tier!`,
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
        value: `**Transaction**\n\`  Player Tag: \`\n\`   Player ID: \`\n\`    Old Tier: \`\n\`    New Tier: \``,
        inline: true,
      },
      {
        name: `\u200B`,
        value: `UPDATE TIER\n${guildMember}\n\`${guildMember.id}\`\n${team.tier}\n${newTier}`,
        inline: true,
      },
    ],
    footer: { text: `Transactions — Update Tier` },
  });

  const cancel = new ButtonBuilder({
    customId: `transactions_${TransactionsUpdateTierOptions.CANCEL}`,
    label: `Cancel`,
    style: ButtonStyle.Danger,
  });

  const confirm = new ButtonBuilder({
    customId: `transactions_${TransactionsUpdateTierOptions.CONFIRM}`,
    label: `Confirm`,
    style: ButtonStyle.Success,
  });

  // create the action row, add the component to it & then reply with all the data
  const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
  return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmUpdateTier(interaction) {
  await interaction.deferReply({ ephemeral: true }); // defer as early as possible

  const data = interaction.message.embeds[0].fields[1].value
    .replaceAll(`\``, ``)
    .split(`\n`);
  const playerID = data[2];

  const player = await Player.getBy({ discordID: playerID });
  const playerIGN = await Player.getIGNby({ discordID: playerID });
  const team = await Team.getBy({ playerID: playerID });
  const franchise = await Franchise.getBy({ teamID: team.id });
  const franchiseTeams = await Franchise.getTeams({ id: franchise.id });

  const newTeam = franchiseTeams.filter((t) => t.tier === data[4])[0];
  const playerTag = playerIGN.split(`#`)[0];
  const guildMember = await interaction.guild.members.fetch(playerID);

  // update the player the player & ensure that the player's team property is now null
  const updatedPlayer = await Transaction.updateTier({
    playerID: player.id,
    teamID: newTeam.id,
  });
  if (updatedPlayer.team !== newTeam.id)
    return await interaction.editReply({
      content: `There was an error while attempting to update the player's tier. The database was not updated.`,
    });

  // create & send the "successfully completed" embed
  const embed = interaction.message.embeds[0];
  const embedEdits = new EmbedBuilder(embed);
  embedEdits.setDescription(`This operation was successfully completed.`);
  embedEdits.setFields([]);
  await interaction.message.edit({ embeds: [embedEdits], components: [] });

  // create the base embed
  const announcement = new EmbedBuilder({
    author: { name: `VDC Transactions Manager` },
    description: `${guildMember} (${playerTag})'s tier was updated!\n${data[3]} => ${data[4]}`,
    thumbnail: {
      url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchise.logoFileName}`,
    },
    color: 0xe92929,
    fields: [
      {
        name: `Franchise`,
        value: `<${franchise.emoteID}> ${franchise.name}`,
        inline: true,
      },
      {
        name: `Team`,
        value: newTeam.name,
        inline: true,
      },
      /** @TODO Once GM discord IDs are in Franchsie Table, show this block */
      // {
      //     name: `General Manager`,
      //     value: `"\${franchise.gm}"`,
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
  requestUpdateTier: requestUpdateTier,
  confirmUpdateTier: confirmUpdateTier,
};
