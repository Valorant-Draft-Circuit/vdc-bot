const { Player, Team } = require(`../../../../prisma`);
const { ChatInputCommandInteraction, EmbedBuilder } = require(`discord.js`);
const { prisma } = require("../../../../prisma/prismadb");


async function forceUpdate(/** @type ChatInputCommandInteraction */ interaction) {
    const { _subcommand, _hoistedOptions } = interaction.options;

    const player = await Player.getBy({ discordID: _hoistedOptions[0].user.id });
    if (player == null) return await interaction.editReply(`This player (${player}, \`${player.username}\`, \`${player.id}\`) does not exist in our database!`);

    const debugUser = _hoistedOptions[0].user;
    const leagueStatus = _hoistedOptions.find(o => o.name === `league-status`);
    const contractStatus = _hoistedOptions.find(o => o.name === `contract-status`);
    const contractRemaining = _hoistedOptions.find(o => o.name === `contract-remaining`);
    const team = _hoistedOptions.find(o => o.name === `team`);

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
    } else delete updatedDataObject.User.update.data.team;

    if (leagueStatus === undefined && contractStatus === undefined && contractRemaining === undefined) delete updatedDataObject.User.update.data.Status;

    if (Object.keys(updatedDataObject.User.update.data).length === 0) return interaction.editReply(`You didn't give any paramaters to update for ${debugUser}`)

    const updatedUser = await prisma.account.update({
        where: { providerAccountId: debugUser.id },
        data: updatedDataObject,
        include: { User: { include: { Status: true, PrimaryRiotAccount: true, Team: true } } }
    });

    const embed = new EmbedBuilder({
        author: { name: `Updated User - ${updatedUser.User.name}`, icon_url: updatedUser.User.image },
        description:
            `\`  Discord Account \` : <@${updatedUser.providerAccountId}>\n` +
            `\` Primary Riot IGN \` : [\`${updatedUser.User.PrimaryRiotAccount.riotIGN}\`](https://tracker.gg/valorant/profile/riot/${encodeURIComponent(updatedUser.User.PrimaryRiotAccount.riotIGN)})`
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

module.exports = { forceUpdate };