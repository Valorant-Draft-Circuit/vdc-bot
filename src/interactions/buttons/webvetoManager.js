const { ButtonInteraction, MessageFlags } = require(`discord.js`);
const { acknowledgeTurn } = require(`../../workers/webVetoAnnouncer`);

module.exports = {
    id: `webvetoManager`,

    async execute(/** @type ButtonInteraction */ interaction, args) {
        const splitargs = args.split(`-`);
        if (splitargs[0] != `ack`) return;

        const matchID = Number(splitargs[1]);
        const rowId = Number(splitargs[2]);

        const stoppedLivePage = acknowledgeTurn(matchID, rowId, interaction.user.tag);
        const content = stoppedLivePage
            ? `Acknowledged. The escalation for this veto turn has been stopped.`
            : `This veto turn page was already handled.`;
        return await interaction.reply({ content: content, flags: MessageFlags.Ephemeral });
    }
};
