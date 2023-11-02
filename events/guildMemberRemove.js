const { CHANNELS, GUILD } = require(`../utils/enums/`);
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
            console.log("Guild:", guild); // Debugging
            
            const farewellChannel = await guild.channels.fetch(CHANNELS.MEMBER_LOGS);
            console.log("Farewell Channel:", farewellChannel); // Debugging
            const embed = new EmbedBuilder({
                type: "rich",
                title: `${member.displayName} has left the server`,
                description: `${member} left the server, bringing the member count to ${guild.memberCount}`,
                color: 0x7e383a,
                timestamp: Date.now(),
            });
            if (farewellChannel) {
                farewellChannel.send({ embeds: [embed] });
            }
        } catch (err) {
            client.logger.console({
                level: 'ERROR',
                title: `${err.name}: Event - ${this.name}`,
                message: err.cause,
                stack: err.stack,
            });
        }
    },
};
