const memberRoleID = `695111015821475860`;

const { EmbedBuilder, ChatInputCommandInteraction, PermissionFlagsBits } = require("discord.js");

module.exports = {

    id: `togglelock`,
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
            return await interaction.reply({ embeds: [notallowed], ephemeral: true });
        }


        let type = ``;
        if (permissionbitfield.has(PermissionFlagsBits.Connect)) {
            // locking the channel
            channel.permissionOverwrites.edit(everyoneRole, { Connect: false });
            type = `locked`;
        } else {
            // unlockign the channel
            channel.permissionOverwrites.edit(everyoneRole, { Connect: true });
            type = `unlocked`;
        }

        const embed = new EmbedBuilder({
            description: `-# 🔐 : ${interaction.member} ${type} the channel!`,
            color: 0x235A81
        });

        await interaction.deferUpdate();
        return await interaction.channel.send({ embeds: [embed] });

    }
};