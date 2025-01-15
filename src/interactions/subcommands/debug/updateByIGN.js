const { LeagueStatus } = require(`@prisma/client`);
const { Player, Transaction, Flags, Team } = require(`../../../../prisma`);
const fs = require(`fs`);
const { ChatInputCommandInteraction, EmbedBuilder } = require(`discord.js`);
const { prisma } = require("../../../../prisma/prismadb");


async function updateByIGN(/** @type ChatInputCommandInteraction */ interaction) {
    const { _subcommand, _hoistedOptions } = interaction.options;

    const ign = _hoistedOptions[0].value;
    const leagueStatus = _hoistedOptions.find(o => o.name === `league-status`);
    const contractStatus = _hoistedOptions.find(o => o.name === `contract-status`);
    const contractRemaining = _hoistedOptions.find(o => o.name === `contract-remaining`);
    const team = _hoistedOptions.find(o => o.name === `team`);
    const teamNull = _hoistedOptions.find(o => o.name === `set-team-null`);

    const player = await Player.getBy({ ign: ign });
    if (player == null) return await interaction.editReply(`There's no player in the database with the IGN \`${ign}\`!`);

    const updatedDataObject = { User: { update: { data: { team: null, Status: { update: {} } } } } };
    if (leagueStatus !== undefined) updatedDataObject.User.update.data.Status.update.leagueStatus = leagueStatus.value;
    if (contractStatus !== undefined) {
        if (contractStatus.value === `999`) updatedDataObject.User.update.data.Status.update.contractStatus = null
        else updatedDataObject.User.update.data.Status.update.contractStatus = contractStatus.value;
    }
    if (contractRemaining !== undefined) {
        if (contractRemaining.value === 999) updatedDataObject.User.update.data.Status.update.contractRemaining = null
        else updatedDataObject.User.update.data.Status.update.contractRemaining = contractRemaining.value;
    }
    if (team !== undefined) {
        const teamData = await Team.getBy({ name: team.value });
        updatedDataObject.User.update.data.team = teamData.id;
    } else if (teamNull !== undefined) {
        updatedDataObject.User.update.data.team = null;
    } else delete updatedDataObject.User.update.data.team;

    if (leagueStatus === undefined && contractStatus === undefined && contractRemaining === undefined) delete updatedDataObject.User.update.data.Status;

    if (Object.keys(updatedDataObject.User.update.data).length === 0) return interaction.editReply(`You didn't give any paramaters to update for \`${ign}\``);

    const updatedUser = await prisma.account.update({
        where: { providerAccountId: player.primaryRiotAccountID },
        data: updatedDataObject,
        include: { User: { include: { Status: true, PrimaryRiotAccount: true, Team: true } } }
    });

    const discordID = player.Accounts.find(a => a.provider == `discord`).providerAccountId;
    const embed = new EmbedBuilder({
        author: { name: `Updated User - ${updatedUser.User.name}`, icon_url: updatedUser.User.image },
        description:
            `\`  Discord Account \` : <@${discordID}>\n` +
            `\` Primary Riot IGN \` : [\`${updatedUser.riotIGN}\`](https://tracker.gg/valorant/profile/riot/${encodeURIComponent(updatedUser.riotIGN)})`
        ,
        color: 0xE92929,
        fields: [
            {
                name: `\u200B`,
                value:
                    `__**Current User State**__ (After Updates)\n` +
                    `\`               Team \` : ${updatedUser.User.Team?.name}\n` +
                    `\`      League Status \` : ${updatedUser.User.Status.leagueStatus}\n` +
                    `\`    Contract Status \` : ${updatedUser.User.Status.contractStatus}\n` +
                    `\` Contract Remaining \` : ${updatedUser.User.Status.contractRemaining}`
                ,
                inline: false
            }
        ],
        footer: { text: `Valorant Draft Circuit — Update User` }
    });

    return await interaction.editReply({ embeds: [embed] });
}

module.exports = { updateByIGN };