const { EmbedBuilder, GuildMember } = require(`discord.js`);
const { Player } = require(`../../prisma`);

/** Riot's API endpoint to fetch a user's account by their puuid 
 * @TODO Update to the internal VDC endpoint once it's ready */
const getAccountByPuuid = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-puuid`;

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

module.exports = {
  name: `profile`,

  async execute(interaction) {
    const { _subcommand, hoistedOptions } = interaction.options;

    switch (_subcommand) {
      case `user`:
        return await interaction.reply({ content: `This is a work in progress, please check back later!` });
      case `update`:
        return await update(interaction);
      default:
        return await interaction.reply({ content: `That's not a valid subcommand or this command is a work in progress!` });
    }
  },
};

async function update(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const userId = interaction.user.id;
  const playerData = await Player.getBy({ discordID: userId });
  if (!playerData.primaryRiotID) return await interaction.editReply({ content: `I looked through our filing cabinets and I don't see your Riot account linked anywhere! Please link one [here](https://vdc.gg/me)!` });

  // get the player's updated IGN from Riot's accountByPuuid endpoint
  const puuid = playerData.primaryRiotID;
  const response = await fetch(`${getAccountByPuuid}/${puuid}?api_key=${process.env.VDC_API_KEY}`);
  if (!response.ok) return await interaction.editReply({ content: `There was a problem checking Riot's filing cabinets! Please try again later and/or let a bot developer know!` });

  const { gameName, tagLine } = await response.json();
  const updatedIGN = `${gameName}#${tagLine}`;

  const ignFromDB = (await Player.getIGNby({ discordID: userId })).split(`#`)[0];
  const riotNameFromDB = ignFromDB.split(`#`)[0];

  /** @type GuildMember */
  const guildMember = await interaction.guild.members.fetch(userId);

  // If database value is the exact same from the API call, don't update the database- simply continue & try to update the nickname
  if (ignFromDB === gameName && guildMember.nickname.includes(gameName)) {
    return await interaction.editReply({ content: `Well... This is awkward. The database already has your most up-to-date IGN and upon some super close inspection, your nickname looks like it's correct as well!!` });
  } else {
    const updatedPlayer = await Player.updateIGN({ puuid: puuid, newRiotID: updatedIGN });
    if (updatedPlayer.riotID !== updatedIGN) return await interaction.editReply({ content: `Looks like there was an error and the database wasn't updated! Please try again later and/or let a bot developer know!` });
  }

  // check to make sure the bot can update the user's nickname
  if (!guildMember.manageable) return await interaction.editReply({ content: `The database was updated to reflect your new IGN: (\`${updatedIGN}\`) but I can't update your nickname- your roles are higher than mine! You will need to update your nickname manually!` });

  // update the user's nickname in the server
  const slug = playerData.franchise.slug;
  const accolades = guildMember.nickname?.match(emoteregex);
  guildMember.setNickname(`${slug} | ${gameName} ${accolades ? accolades.join(``) : ``}`);

  // create the success update "announcement"
  const embed = new EmbedBuilder({
    description: `${guildMember}'s nickname has been updated!`,
    color: 0x008000,
    fields: [
      { name: `From:`, value: riotNameFromDB, inline: true },
      { name: `To:`, value: gameName, inline: true },
    ],
    footer: { text: `Profile - Update` },
  });

  // ephemerally update status and then exit with the announcement
  await interaction.editReply({ content: `Success! The database, your nickname & your Riot IGN are all in sync!` });
  return await interaction.channel.send({ embeds: [embed] });
}
