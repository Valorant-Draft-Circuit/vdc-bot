const { ROLES } = require("../../utils/enums");

module.exports = {

    name: `active`,

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const guildMember = await interaction.guild.members.fetch(interaction.member.id);

        // remove the inactive role
        if (guildMember._roles.includes(ROLES.LEAGUE.INACTIVE)) {
            await guildMember.roles.remove(ROLES.LEAGUE.INACTIVE);
            return await interaction.editReply({ content: `You have completed the activity check and been marked as an active player! Good luck in your matches!` });
        } else {
            return await interaction.editReply({ content: `You've already completed the activity check! You're... super active!` });
        }

    }
};