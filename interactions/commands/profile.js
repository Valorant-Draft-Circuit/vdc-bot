const { EmbedBuilder } = require("discord.js");
const { Player } = require("../../prisma");
// TODO: create endpoint via vdc website
const byPuuid =
  "https://americas.api.riotgames.com/riot/account/v1/accounts/by-puuid";

module.exports = {
  name: "profile",

  async execute(interaction) {
    const { _subcommand, hoistedOptions } = interaction.options;

    switch (_subcommand) {
      case `user`:
        interaction.reply({
          content: `This is a work in progress, please check back later!`,
        });
        break;
      case `update`:
        update(interaction);
        break;
      default:
        interaction.reply({
          content: `That's not a valid subcommand or this command is a work in progress!`,
        });
        break;
    }
  },
};

async function update(interaction) {
  await interaction.deferReply();

  const userId = interaction.user.id;
  const playerData = await Player.getInfoBy({ discordID: userId });
  const puuid = playerData.primaryRiotID;

  if (puuid == null) {
    const embed = new EmbedBuilder({
      author: { name: `Error` },
      color: 0xe92929,
      footer: {
        text: "Profile - Update",
      },
    });
    embed.setDescription(
      "You don't have a Riot account linked. Please link one [here](https://vdc.gg/me)."
    );
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true,
    });
  }
  const riotIDFromDB = await Player.getIGNby({ discordID: userId });
  const riotNameFromDB = riotIDFromDB.split("#")[0];

  const endpoint = `${byPuuid}/${puuid}?api_key=${process.env.VDC_API_KEY}`;
  const response = await fetch(endpoint);
  const data = await response.json();
  const riotIDFromRiot = `${data.gameName}#${data.tagLine}`;

  // If database value is the exact same from the API call
  if (riotIDFromDB === riotIDFromRiot) {
    const embed = new EmbedBuilder({
      author: { name: `Error` },
      description:
        "This is awkward because your discord nickname is already the same as your Valorant IGN...",
      color: 0xe92929,
      footer: {
        text: "Profile - Update",
      },
    });
    return interaction.editReply({
      embeds: [embed],
      ephemeral: true,
    });
    // If they only updated their tagline.
  } else if (
    data.gameName === riotIDFromDB &&
    data.tagLine !== riotIDFromDB.split("#")[1]
  ) {
    await Player.updateRiotID({ puuid: puuid, newRiotID: riotIDFromRiot });
    const embed = new EmbedBuilder({
      author: { name: `Success` },
      description: "Your Riot tagline has been updated!",
      color: 0x008000,
      footer: {
        text: "Profile - Update",
      },
    });

    return interaction.editReply({
      embeds: [embed],
      ephemeral: true,
    });
    // If they updated their riot id
  } else if (data.gameName !== riotNameFromDB) {
    const guildMember = await interaction.guild.members.fetch(userId);
    await Player.updateRiotID({puuid: puuid, newRiotID: riotIDFromRiot});

    const playerIGN = await Player.getIGNby({ discordID: userId });
    const emoteregex =
      /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
    const playerTag = playerIGN.split(`#`)[0];
    const accolades = guildMember.nickname?.match(emoteregex);
    const slug = guildMember.nickname.split(" | ")[0];

    guildMember.setNickname(
      `${slug} | ${playerTag} ${accolades ? accolades.join(``) : ``}`
    );

    const embed = new EmbedBuilder({
      author: { name: `Success` },
      description: `${guildMember}'s nickname has been updated!`,
      color: 0x008000,
      fields: [
        {
          name: `From:`,
          value: riotNameFromDB,
        },
        {
          name: `To:`,
          value: playerTag,
        },
      ],
      footer: {
        text: "Profile - Update",
      },
    });

    return interaction.editReply({
      embeds: [embed],
      ephemeral: false,
    });
  }
}
