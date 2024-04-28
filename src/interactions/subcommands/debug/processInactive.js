const { LeagueStatus } = require(`@prisma/client`);
const { Player, Transaction, Flags } = require(`../../../../prisma`);
const fs = require(`fs`);
const { ChatInputCommandInteraction, EmbedBuilder } = require(`discord.js`);
const { prisma } = require("../../../../prisma/prismadb");
const { ROLES } = require("../../../../utils/enums");

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;


async function processInactive(/** @type ChatInputCommandInteraction */ interaction) {
    const { _hoistedOptions } = interaction.options;
    const discordID = _hoistedOptions[0].value;

    const player = await Player.getBy({ discordID: discordID });
    const playerIGN = await Player.getIGNby({ discordID: discordID });
    if (player === null) return await interaction.editReply(`This player doesn't exist in the database!`);

    const guildMember = await interaction.guild.members.fetch(discordID);


    // remove all league roles and then add League & franchise role
    const franchiseRoleIDs = (await prisma.franchise.findMany({ where: { active: true } })).map(f => f.roleID);
    await guildMember.roles.remove([
        ...Object.values(ROLES.LEAGUE),
        ...Object.values(ROLES.TIER),
        ...franchiseRoleIDs
    ]);
    await guildMember.roles.add(ROLES.LEAGUE.VIEWER)

    // get player info (IGN, Accolades) & update their nickname
    const playerTag = playerIGN.split(`#`)[0];
    const accolades = guildMember.nickname?.match(emoteregex);
    guildMember.setNickname(`${playerTag} ${accolades ? accolades.join(``) : ``}`);


    await prisma.user.update({
        where: { id: player.id },
        data: {
            team: null,
            Status: {
                update: {
                    leagueStatus: LeagueStatus.UNREGISTERED,
                    contractStatus: null,
                    contractRemaining: null
                }
            }
        }
    });
    await Player.modifyFlags(
        { userID: player.id },
        `REMOVE`,
        [
            Flags.REGISTERED_AS_RFA, Flags.REVIEW_PENDING, Flags.NEW_PLAYER, Flags.ACTIVE_LAST_SEASON
        ]
    );

    return await interaction.editReply(`The player (<@${discordID}>) has been processed as inactive. Their league & tier roles have been removed and their nickname has been updated in the discord server. Their team has been set to \`null\` in the database, as well as their leagueStatus being set to \`UNREGISTERED\`, contractStatus to \`null\` and contractRemaing to \`null\``);
}

module.exports = { processInactive };