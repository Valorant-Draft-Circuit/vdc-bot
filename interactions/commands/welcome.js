const { Player } = require("../../prisma");
const { CHANNELS, ROLES } = require(`../../utils/enums`);

module.exports = {

    name: `welcome`,

    async execute(interaction) {

        const { _hoistedOptions } = interaction.options;
        const player = _hoistedOptions[0];
        const status = _hoistedOptions[1].value;

        const guildMember = await interaction.guild.members.fetch(player.value);
        const acceptedChannel = await interaction.guild.channels.fetch(CHANNELS.ACCEPTED_MEMBERS);

        // renove the viewer role & add the league role
        if (guildMember._roles.includes(ROLES.LEAGUE.VIEWER)) await guildMember.roles.remove(ROLES.LEAGUE.VIEWER);
        await guildMember.roles.add(ROLES.LEAGUE.LEAGUE);

        // update the name to match convention
        const ign = (await Player.getIGNby({ discordID: player.value })).split(`#`)[0];
        guildMember.setNickname(`${status} | ${ign}`);

        // assign the proper roles & send the correct message
        switch (status) {
            case `DE`:
                await guildMember.roles.add(ROLES.LEAGUE.DRAFT_ELIGIBLE);
                acceptedChannel.send({ content: `Welcome ${player.user} to the league as a DE!` });
                break;
            case `RFA`:
                await guildMember.roles.add(ROLES.LEAGUE.RESTRICTED_FREE_AGENT);
                acceptedChannel.send({ content: `Welcome ${player.user} to the league as an RFA!` });
                break;
            default:
                throw new Error(`INVALID STATUS VALUE. EXPECTED DE or RFA & instead got ${status}`);
        }

        interaction.reply({ content: `Success!`, ephemeral : true })
    }
};