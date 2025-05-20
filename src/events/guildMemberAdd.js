const { GuildMember, MessageFlags } = require(`discord.js`);
const { ControlPanel } = require("../../prisma");
const { GUILD } = require("../../utils/enums");

const generalChatID = !Boolean(Number(process.env.PROD)) ?
    `1059244366671118487` : // bot-spam
    `963274331864047618`;   // VDC gen chat

const welcomePingRoleID = !Boolean(Number(process.env.PROD)) ?
    `1172963557504209027` : // tech lead role
    `1357081780095549681`;  // welcome role

module.exports = {

    /**
     * Emitted whenever someone joins the server.
     * @type {Event} 
     */

    name: 'guildMemberAdd',
    once: false,

    async execute(client, /** @type {GuildMember} */ member) {

        if (!Boolean(Number(process.env.PROD))) return;

        // send the join info in the memberdrain channel
        const guild = await client.guilds.fetch(member.guild.id);
        logger.memberdrain(`📥 <t:${Math.round(Date.now() / 1000)}:d> <t:${Math.round(Date.now() / 1000)}:T> **Member joined** - __Server__: \`${member.guild.name}\` **|** (\`${guild.memberCount}\`) , __User__: ${member}, __Name__: \`${member.user.username}\`,  __ID__: \`${member.id}\``);

        // if not in the main VDC server, then return and do nothing else
        if (member.guild.id !== GUILD) return;

        // build the message
        const welcomeMessage = (await ControlPanel.getWelcomeMessage()).replace(`{welcome}`, `<@&${welcomePingRoleID}>`).replace(`{user}`, `<@${member.id}>`);
        const messageBody = [
            `- See the sign up guide here: https://discord.com/channels/963274331251671071/963347135342985306`,
            `- Check out our [new player guide](https://blog.vdc.gg/new-player-guide/) or view the condensed version here: https://discord.com/channels/963274331251671071/1354229508441510039`,
            `- Get general info and see FAQs at our wiki: https://discord.com/channels/963274331251671071/1319803211850448896`,
            `- Still have questions? Use https://discord.com/channels/963274331251671071/1047026533467967549 or open a ticket: https://discord.com/channels/963274331251671071/966924427709276160`
        ].join(`\n`);
        const messageFooter = `\n-# Want to be pinged to welcome new players? Add the <@&${welcomePingRoleID}> role in the \`Channels & Roles\` section at the top of the channel list!`;

        // fetch the channel & send the message
        const channel = await client.channels.fetch(generalChatID);
        const msg = await channel.send({ content: [welcomeMessage, messageBody, messageFooter].join(`\n`), flags: MessageFlags.SuppressEmbeds });
        logger.log(`INFO`, `Sent welcome message for ${member} (\`${member.user.username}\`, \`${member.id}\`) : ${msg.url}`);
    }
};
