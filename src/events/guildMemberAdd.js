const { CHANNELS, GUILD } = require(`../../utils/enums`);
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
            
            const welcomeChannel = await guild.channels.fetch(CHANNELS.MEMBER_LOGS);
            const embed = new EmbedBuilder({
                title: `${member.displayName} has joined the server`,
                description: `${member} joined the server, bringing the member count to ${guild.memberCount}`,
                color: 0x7e383a,
                timestamp: Date.now(),
            });
            if (welcomeChannel) {
                welcomeChannel.send({ embeds: [embed] });
            }
        } catch (err) {
            logger.log(`ERROR`, `${err.name} - ${this.name}`, err.stack);
        }

}};
