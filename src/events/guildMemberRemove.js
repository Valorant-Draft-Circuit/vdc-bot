const { LeagueStatus, ContractStatus } = require("@prisma/client");
const { Player, Transaction } = require("../../prisma");
const { prisma } = require("../../prisma/prismadb");
const { CHANNELS, GUILD } = require(`../../utils/enums`);
const { EmbedBuilder } = require(`discord.js`);


module.exports = {

    /**
     * Emitted whenever someone leaves the server.
     * @type {Event}
     * @references
     * 
     */

    name: 'guildMemberRemove',
    once: false,

    async execute(client, member) {
        try {

            const guild = await client.guilds.fetch(GUILD);

            const farewellChannel = await guild.channels.fetch(CHANNELS.MEMBER_LOGS);
            const embed = new EmbedBuilder({
                title: `${member.displayName} has left the server`,
                description: `${member} left the server, bringing the member count to ${guild.memberCount}`,
                color: 0x7e383a,
                timestamp: Date.now(),
            });

            if (farewellChannel) farewellChannel.send({ embeds: [embed] });

            const player = await Player.getBy({ discordID: member.id });
            if (player) {
                await prisma.status.update({
                    where: { userID: player.id },
                    data: {
                        leagueStatus: LeagueStatus.SUSPENDED,
                        contractStatus: null,
                        contractRemaining: null,
                        Player: { update: { data: { team: null } } }
                    }
                });
            };

        } catch (err) {
            logger.log(`ERROR`, `${err.name} - ${this.name}`, err.stack);
        }
    },
};
