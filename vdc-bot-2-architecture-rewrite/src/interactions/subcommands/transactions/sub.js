const { ChatInputCommandInteraction, GuildMember } = require("discord.js");

const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
} = require("discord.js");

/** Send confirmation to SUb a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 * @param {GuildMember} subFor
 */

async function requestSub(interaction, player, subFor) {
  await interaction.deferReply();

  const playerData = await Player.getBy({ discordID: player.id });
  const subForData = await Player.getBy({ discordID: subFor.id });

  if (subForData.team == null)
    return await interaction.editReply({
      content: `The player you're trying to sub out isn't on a team!`,
      ephemeral: false,
    });

  const teamData = await Team.getBy({ id: subForData.team });
  const roster = (await Team.getRosterBy({ id: subForData.team })).filter(
    (player) =>
      player.status === PlayerStatusCode.SIGNED &&
      player.contractStatus !== ContractStatus.INACTIVE_RESERVE
  );
  const franchiseData = await Franchise.getBy({ id: teamData.franchise });

  const oldMMR = sum(roster.map((p) => p.MMR_Player_MMRToMMR.mmr_overall));
  const mmrWithoutSubbedOutPlayer = sum(
    roster
      .filter((p) => p.id !== subFor.id)
      .map((p) => p.MMR_Player_MMRToMMR.mmr_overall)
  );
  const newMMR =
    mmrWithoutSubbedOutPlayer + playerData.MMR_Player_MMRToMMR.mmr_overall;

  const activeSubTime = 8 /* Hours a sub is active for the team */ * 60 * 60; // conversion to milliseconds
  const unsubTime = Math.round(Date.now() / 1000) + activeSubTime;

  // checks
  if (playerData == undefined)
    return await interaction.editReply({
      content: `This player doesn't exist!`,
      ephemeral: false,
    });
  if (newMMR > teamMMRAllowance[teamData.tier.toLowerCase()])
    return await interaction.editReply({
      content: `This player cannot be a substitute for ${
        teamData.name
      }, doing so would exceed the tier's MMR cap!\nAvailable MMR: ${
        oldMMR - mmrWithoutSubbedOutPlayer
      }\nSub MMR: ${playerData.MMR_Player_MMRToMMR.mmr_overall}`,
      ephemeral: false,
    });
  if (
    ![
      PlayerStatusCode.FREE_AGENT,
      PlayerStatusCode.RESTRICTED_FREE_AGENT,
    ].includes(playerData.status)
  )
    return await interaction.editReply({
      content: `This player is not a Free Agent/Restricted Free Agent and cannot be signed to ${teamData.name}!`,
      ephemeral: false,
    });
  if (playerData.contractStatus === ContractStatus.ACTIVE_SUB)
    return await interaction.editReply({
      content: `This player is already an active sub and cannot sign another temporary contract!`,
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
        value: `**Transaction**\n\`  Player Tag: \`\n\`   Player ID: \`\n\`         MMR: \`\n\`        Team: \`\n\`   Franchise: \`\n\`  Unsub Time: \``,
        inline: true,
      },
      {
        name: `\u200B`,
        value: `SUB\n${player.user}\n\`${
          player.id
        }\`\n\`${oldMMR} => ${newMMR} / ${
          teamMMRAllowance[teamData.tier.toLowerCase()]
        }\`\n${teamData.name}\n${
          franchiseData.name
        }\n<t:${unsubTime}:t> (<t:${unsubTime}:R>)`,
        inline: true,
      },
    ],
    footer: { text: `Transactions — Sub` },
  });

  const cancel = new ButtonBuilder({
    customId: `transactions_${TransactionsSubTypes.CANCEL}`,
    label: `Cancel`,
    style: ButtonStyle.Danger,
  });

  const confirm = new ButtonBuilder({
    customId: `transactions_${TransactionsSubTypes.CONFIRM_SUB}`,
    label: `Confirm`,
    style: ButtonStyle.Success,
  });

  // create the action row, add the component to it & then editReply with all the data
  const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
  return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmSub(interaction) {
  await interaction.deferReply({ ephemeral: true }); // defer as early as possible

  const data = interaction.message.embeds[0].fields[1].value
    .replaceAll(`\``, ``)
    .split(`\n`);
  const playerID = data[2];

  const playerData = await Player.getBy({ discordID: playerID });
  const playerIGN = await Player.getIGNby({ discordID: playerID });
  const teamData = await Team.getBy({ name: data[4] });
  const franchiseData = await Franchise.getBy({ name: data[5] });

  const playerTag = playerIGN.split(`#`)[0];
  const guildMember = await interaction.guild.members.fetch(playerID);

  // cut the player & ensure that the player's team property is now null
  const player = await Transaction.sub({
    playerID: playerID,
    teamID: teamData.id,
  });
  if (player.team !== teamData.id)
    return await interaction.editReply({
      content: `There was an error while attempting to sub the player. The database was not updated.`,
    });

  const embed = interaction.message.embeds[0];
  const embedEdits = new EmbedBuilder(embed);
  embedEdits.setDescription(`This operation was successfully completed.`);
  embedEdits.setFields([]);
  await interaction.message.edit({ embeds: [embedEdits], components: [] });

  // create the base embed
  const announcement = new EmbedBuilder({
    author: { name: `VDC Transactions Manager` },
    description: `${guildMember} (${playerTag}) has signed a temporary contract with ${franchiseData.name}!`,
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
    footer: { text: `Transactions — Sub` },
    timestamp: Date.now(),
  });

  await transactionsAnnouncementChannel.send({ embeds: [announcement] });

  const activeSubTimeMS =
    8 /* Hours a sub is active for the team */ * 60 * 60 * 1000; // conversion to milliseconds
  setTimeout(async () => {
    // unsub the player & ensure that the player's team property is now null
    const player = await Transaction.unsub({ playerID: playerData.id });
    if (player.team !== null)
      return await interaction.channel.send({
        content: `There was an error while attempting to unsub ${guildMember} (${playerTag}). The database was not updated.`,
      });

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

    return await transactionsAnnouncementChannel.send({
      embeds: [announcement],
    });
  }, activeSubTimeMS);
}
module.exports = {
  requestSub: requestSub,
  confirmSub: confirmSub,
};
