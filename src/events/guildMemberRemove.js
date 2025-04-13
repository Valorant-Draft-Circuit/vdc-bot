const { LeagueStatus } = require("@prisma/client");
const { Player } = require("../../prisma");
const { prisma } = require("../../prisma/prismadb");
const { GUILD } = require(`../../utils/enums`);
const { GuildMember } = require(`discord.js`);


module.exports = {

    /**
     * Emitted whenever someone leaves the server.
     * @type {Event}
     * @references
     * 
     */

    name: 'guildMemberRemove',
    once: false,


    async execute(client, /** @type {GuildMember} */ member) {

        if (!Boolean(Number(process.env.PROD))) return;

        const guild = await client.guilds.fetch(member.guild.id);

        logger.memberdrain(`📤 <t:${Math.round(Date.now() / 1000)}:d> <t:${Math.round(Date.now() / 1000)}:T> **Member left** - __Server__: \` ${member.guild.name} \` **|** (\`${guild.memberCount}\`) , __User__: ${member}, __Name__: \` ${member.user.username} \`,  __ID__: \` ${member.id} \``);



        if (member.guild.id == GUILD) {
            const player = await Player.getBy({ discordID: member.id });
            if (!player) return;

            switch (player.Status.leagueStatus) {
                case LeagueStatus.PENDING:
                case LeagueStatus.APPROVED:
                case LeagueStatus.DRAFT_ELIGIBLE:
                    // revert to UNREGISTERED LeagueStatus

                    logger.log(`INFO`, `Player \`${player.name}\` (IGN: \`${player.PrimaryRiotAccount.riotIGN}\`, ID: \`${player.id}\`) has left \` ${member.guild.name} \`, with a league status of \`${player.Status.leagueStatus}\` — updating their status to \`UNREGISTERED\``);
                    await prisma.status.update({
                        where: { userID: player.id },
                        data: {
                            leagueStatus: LeagueStatus.UNREGISTERED,
                            contractStatus: null,
                            contractRemaining: null,
                            Player: { update: { data: { team: null } } }
                        }
                    });
                    break;

                case LeagueStatus.FREE_AGENT:
                case LeagueStatus.RESTRICTED_FREE_AGENT:
                case LeagueStatus.SIGNED:
                case LeagueStatus.GENERAL_MANAGER:
                    // revert to SUSPENDED LeagueStatus

                    logger.log(`ALERT`, `Player \`${player.name}\` (IGN: \`${player.PrimaryRiotAccount.riotIGN}\`, ID: \`${player.id}\`) has left \` ${member.guild.name} \`, with a league status of \`${player.Status.leagueStatus}\` — updating their status to \`SUSPENDED\``);
                    await prisma.status.update({
                        where: { userID: player.id },
                        data: {
                            leagueStatus: LeagueStatus.SUSPENDED,
                            contractStatus: null,
                            contractRemaining: null,
                            Player: { update: { data: { team: null } } }
                        }
                    });
                    break

                default:
                    break;
            }
        }
    },
};
