const { GuildMember } = require(`discord.js`);

module.exports = {

    /**
     * Emitted whenever someone joins the server.
     * @type {Event}
     * @references
     * 
     */


    name: 'guildMemberAdd',
    once: false,

    async execute(client, /** @type {GuildMember} */ member) {

        const guild = await client.guilds.fetch(member.guild.id);

        logger.memberdrain(`📥 <t:${Math.round(Date.now() / 1000)}:d> <t:${Math.round(Date.now() / 1000)}:T> **Member joined** - __Server__: \` ${member.guild.name} \` **|** (\`${guild.memberCount}\`) , __User__: ${member}, __Name__: \` ${member.user.username} \`,  __ID__: \` ${member.id} \``);

    }
};
