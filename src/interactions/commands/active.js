const { ChatInputCommandInteraction, MessageFlags } = require(`discord.js`)
const { LeagueStatus } = require("@prisma/client");
const { Player } = require(`../../../prisma`);
const { prisma } = require("../../../prisma/prismadb");
const { ROLES } = require("../../../utils/enums");

module.exports = {

    name: `active`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const member = interaction.member;
        const player = await Player.getBy({ discordID: member.id });
        const activityCheckState = await prisma.controlPanel.findFirst({ where: { name: `activity_check_state` } });

        const invalidLeagueStatusStates = [
            LeagueStatus.UNREGISTERED, LeagueStatus.PENDING, LeagueStatus.APPROVED,
            LeagueStatus.RETIRED, LeagueStatus.SUSPENDED, LeagueStatus.MANUAL_REVIEW
        ];

        if (invalidLeagueStatusStates.includes(player.Status.leagueStatus)) {
            logger.log(`VERBOSE`, `User ${member} (\`${member.user.username}\`, \`${member.id}\`) attempted to run the activity check with an invalid status (\`${player.Status.leagueStatus}\`)`);
            return await interaction.editReply(`You cannot complete the activity check. Please open an admin ticket.`);
        }

        switch (activityCheckState?.value) {
            case `CLOSED`:
                logger.log(`VERBOSE`, `User ${member} (\`${member.user.username}\`, \`${member.id}\`) attempted to run the activity check while it's closed`);
                return await interaction.editReply(`The activity check is closed!`);

            case `RETURNING_OPEN`:
                const validStates = [LeagueStatus.SIGNED, LeagueStatus.FREE_AGENT, LeagueStatus.GENERAL_MANAGER];
                if (validStates.includes(player.Status.leagueStatus)) return await removeInactiveRole(interaction);
                else return await interaction.editReply(`The activity check is only open for players who are Signed, Free Agents and General Managers!`);

            case `OPEN`:
                logger.log(`VERBOSE`, `User ${member} (\`${member.user.username}\`, \`${member.id}\`) attempted to run the activity check`);
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
        logger.log(`VERBOSE`, `User ${guildMember} (\`${guildMember.user.username}\`, \`${guildMember.id}\`) has successfully ran the activity check`);
        await guildMember.roles.remove(ROLES.LEAGUE.INACTIVE);
        return await interaction.editReply(`You have completed the activity check and been marked as an active player! Good luck in your matches!`);
    } else {
        logger.log(`VERBOSE`, `User ${guildMember} (\`${guildMember.user.username}\`, \`${guildMember.id}\`) is... super active!`);
        return await interaction.editReply(`You've already completed the activity check! You're... super active!`);
    }
};