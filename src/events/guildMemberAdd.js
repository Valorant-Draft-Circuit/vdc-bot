const { GuildMember, MessageFlags } = require(`discord.js`);
const { ControlPanel } = require("../../prisma");

const generalChatID = !Boolean(Number(process.env.PROD)) ?
    `1059244366671118487` : // bot-spam
    `963274331864047618`; // VDC gen chat

const welcomePingRoleID = !Boolean(Number(process.env.PROD)) ?
    `1172963557504209027` : // tech lead role
    `1357086417972494467`; // welcome role

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

        // send the join info in the memberdrain channel
        const guild = await client.guilds.fetch(member.guild.id);
        logger.memberdrain(`📥 <t:${Math.round(Date.now() / 1000)}:d> <t:${Math.round(Date.now() / 1000)}:T> **Member joined** - __Server__: \` ${member.guild.name} \` **|** (\`${guild.memberCount}\`) , __User__: ${member}, __Name__: \` ${member.user.username} \`,  __ID__: \` ${member.id} \``);

        // build the message
        const welcomeMessage = (await ControlPanel.getWelcomeMessage()).replace(`{welcome}`, `<@&${welcomePingRoleID}>`).replace(`{user}`, `<@${member.id}>`);
        const messageBody = [
            `- See the sign up guide here: https://discord.com/channels/963274331251671071/963347135342985306`,
            `- Check out our [new player guide](https://blog.vdc.gg/new-player-guide/) or view the condensed version here: https://discord.com/channels/963274331251671071/1354229508441510039`,
            `- Get general info and see FAQs at our wiki: https://discord.com/channels/963274331251671071/1319803211850448896`,
            `- Check out VDC's franchises here: https://discord.com/channels/963274331251671071/1047026056126812212`,
            `- Still have questions? Use https://discord.com/channels/963274331251671071/1047026533467967549 or open a https://discord.com/channels/963274331251671071/966924427709276160`
        ].join(`\n`);
        const messageFooter = `\n-# Want to be pinged to welcome new players? Add the <@&${welcomePingRoleID}> role in the \`Channels & Roles\` section at the top of the channel list!`;

        // fetch the channel & send the message
        const channel = await client.channels.fetch(generalChatID);
        channel.send({ content: [welcomeMessage, messageBody, messageFooter].join(`\n`), flags: MessageFlags.SuppressEmbeds });
    }
};
