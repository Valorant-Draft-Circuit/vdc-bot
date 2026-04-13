const { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } = require(`discord.js`);
const { CHANNELS } = require(`../../../utils/enums/channels`);

module.exports = {

    name: `mapbans-add`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: `This command can only be used in a server.`,
                flags: [MessageFlags.Ephemeral]
            });
        }

        await interaction.deferReply();

        const channel = interaction.channel;
        if (channel.parentId !== CHANNELS.CATEGORIES.MAPBANS) {
            return interaction.editReply({
                content: `This command can only be used in mapbans channels.`
            });
        }

        const targetUser = interaction.options.getUser(`user`);

        await channel.permissionOverwrites.edit(targetUser.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AddReactions: true,
        });

        const embed = new EmbedBuilder({
            title: `User Added to Mapbans`,
            description: `${targetUser} has been added to ${channel} by ${interaction.user}.`,
            color: 0x57F287,
        });

        return interaction.editReply({ content: `${targetUser}`, embeds: [embed] });
    }
};
