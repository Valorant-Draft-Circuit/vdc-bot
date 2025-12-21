const { prisma } = require(`../../../prisma/prismadb`);
const { StringSelectMenuInteraction, EmbedBuilder } = require(`discord.js`);


module.exports = {

    id: `toggleMembers`,

    async execute(/** @type StringSelectMenuInteraction */ interaction) {
        await interaction.deferUpdate();

        const channelMembersArray = interaction.channel.members.map(u => u.user.id);
        if (!channelMembersArray.includes(interaction.member.id)) {
            const notallowed = new EmbedBuilder({
                description: `You're not in this voice channel and thus cannot modify its settings!`,
                color: 0x235A81
            });
            return await interaction.reply({ embeds: [notallowed], flags: [MessageFlags.Ephemeral] });
        }

        const memberUptate = Number(interaction.values[0]);
        let message = memberUptate;

        switch (memberUptate) {
            case 0: {
                await interaction.channel.setUserLimit();
                message = `∞`;
            }
            default: {
                await interaction.channel.setUserLimit(memberUptate);
            }
        }

        const embed = new EmbedBuilder({
            description: `-# 🔢 : ${interaction.member} has updated the channel join limit to : \` ${message} \`!`,
            color: 0x235A81
        });

        return await interaction.channel.send({ embeds: [embed] });
    }
};