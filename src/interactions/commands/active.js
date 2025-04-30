const { ChatInputCommandInteraction, MessageFlags } = require(`discord.js`)
const { LeagueStatus } = require("@prisma/client");
const { Player } = require(`../../../prisma`);
const { prisma } = require("../../../prisma/prismadb");
const { ROLES } = require("../../../utils/enums");

module.exports = {

    name: `active`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const player = await Player.getBy({ discordID: interaction.member.id });
        const activityCheckState = await prisma.controlPanel.findFirst({ where: { name: `activity_check_state` } });

        const invalidLeagueStatusStates = [
            LeagueStatus.UNREGISTERED, LeagueStatus.PENDING, LeagueStatus.APPROVED,
            LeagueStatus.RETIRED, LeagueStatus.SUSPENDED
        ];

        if (invalidLeagueStatusStates.includes(player.Status.leagueStatus)) {
            return await interaction.editReply(`You cannot complete the activity check. Please open an admin ticket.`);
        }

        switch (activityCheckState?.value) {
            case `CLOSED`:
                return await interaction.editReply(`The activity check is closed!`);

            case `RETURNING_OPEN`:
                const validStates = [LeagueStatus.SIGNED, LeagueStatus.FREE_AGENT, LeagueStatus.GENERAL_MANAGER];
                if (validStates.includes(player.Status.leagueStatus)) return await removeInactiveRole(interaction);
                else return await interaction.editReply(`The activity check is only open for players who are Signed, Free Agents and General Managers!`);

            case `OPEN`:
                return await removeInactiveRole(interaction);

            default:
                return await interaction.editReply(`There's an error. The activity check state flag has an invalid value. Please open an admin ticket.`);
        }
    }
};

async function removeInactiveRole(/** @type ChatInputCommandInteraction */ interaction) {
    const guildMember = await interaction.guild.members.fetch(interaction.member.id);

    // remove the inactive role
    if (guildMember._roles.includes(ROLES.LEAGUE.INACTIVE)) {
        await guildMember.roles.remove(ROLES.LEAGUE.INACTIVE);
        return await interaction.editReply(`You have completed the activity check and been marked as an active player! Good luck in your matches!`);
    } else {
        return await interaction.editReply(`You've already completed the activity check! You're... super active!`);
    }
};