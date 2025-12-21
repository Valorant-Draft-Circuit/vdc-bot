const everyoneRole = `695111015821475860`;

const { EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } = require("discord.js");

module.exports = {

    id: `toggleprivate`,
    async execute(/** @type ChatInputCommandInteraction */ interaction, args) {
        const everyoneRole = interaction.channel.guild.roles.everyone;

        const channel = interaction.channel;
        const permissionbitfield = channel.permissionsFor(everyoneRole);

        const channelMembersArray = interaction.channel.members.map(u => u.user.id);
        if (!channelMembersArray.includes(interaction.member.id)) {
            const notallowed = new EmbedBuilder({
                description: `You're not in this voice channel and thus cannot modify its settings!`,
                color: 0x235A81
            });
            return await interaction.reply({ embeds: [notallowed], flags: [MessageFlags.Ephemeral] });
        }


        let type = ``;
        if (permissionbitfield.has(PermissionFlagsBits.ViewChannel)) {
            // making the channel private
            channel.permissionOverwrites.edit(everyoneRole, { ViewChannel: false });
            type = `private`;
        } else {
            // making the channel public
            channel.permissionOverwrites.edit(everyoneRole, { ViewChannel: true });
            type = `public`;
        }

        const embed = new EmbedBuilder({
            description: `-# 👥 : ${interaction.member} made the channel ${type}!`,
            color: 0x235A81
        });

        await interaction.deferUpdate();
        return await interaction.channel.send({ embeds: [embed] });

    }
};