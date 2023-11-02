const { CHANNELS, GUILD } = require(`../utils/enums/`);
const { EmbedBuilder } = require(`discord.js`);

module.exports = {

    /**
     * Emitted whenever someone joins the server.
     * @type {Event}
     * @references
     * 
     */


    name: 'guildMemberAdd',
    once: false,

    async execute(client, member) {
        try {

            const guild = await client.guilds.fetch(GUILD);
            console.log("Guild:", guild); // Debugging
            
            const welcomeChannel = await guild.channels.fetch(CHANNELS.MEMBER_LOGS);
            console.log("Welcome Channel:", welcomeChannel); // Debugging
            const embed = new EmbedBuilder({
                type: "rich",
                title: `${member.displayName} has joined the server`,
                description: `${member} joined the server, bringing the member count to ${guild.memberCount}`,
                color: 0x7e383a,
                timestamp: Date.now(),
            });
            if (welcomeChannel) {
                welcomeChannel.send({ embeds: [embed] });
            }
        } catch (err) {
            client.logger.console({
                level: 'ERROR',
                title: `${err.name}: Event - ${this.name}`,
                message: err.cause,
                stack: err.stack,
            });
        }

}};
