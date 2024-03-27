const { EmbedBuilder } = require("discord.js");

module.exports = {

    name: `topic`,

    execute(interaction) {

        const topic = interaction.channel.topic;

        if (topic == undefined) return interaction.reply({ content: `This channel doesn't have a topic!`, ephemeral: true });

        const embed = new EmbedBuilder({
            description: `Please keep conversations in this channel on topic!`,
            color: 0xE92929,
            thumbnail: { url: `https://cdn.discordapp.com/banners/963274331251671071/57044c6a68be1065a21963ee7e697f80.webp` },
            fields: [
                {
                    name: `\u200B`,
                    value: `${interaction.channel} : ${topic}`,
                    inline: true
                }
            ],
            footer: { text: `Valorant Draft Circuit — Mod Commands — Channel Topic Reminder` }
        });

        return interaction.reply({ embeds: [embed] });
    }
};