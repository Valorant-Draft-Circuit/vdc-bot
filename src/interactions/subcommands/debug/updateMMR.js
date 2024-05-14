const { Player } = require(`../../../../prisma`);
const { ChatInputCommandInteraction, EmbedBuilder } = require(`discord.js`);
const { prisma } = require("../../../../prisma/prismadb");


async function updateMMR(/** @type ChatInputCommandInteraction */ interaction) {
    const { _subcommand, _hoistedOptions } = interaction.options;


    const guildMember = _hoistedOptions[0].user;
    const newMMR = _hoistedOptions[1].value;

    const player = await Player.getBy({ discordID: guildMember.id });
    const mmrEntry = player.PrimaryRiotAccount.MMR;
    const oldMMR = mmrEntry.mmrEffective;

    await prisma.mMR.update({
        where: { id: mmrEntry.id },
        data: { mmrEffective: newMMR }
    });

    const discordID = player.Accounts.find(a => a.provider == `discord`).providerAccountId;
    const embed = new EmbedBuilder({
        author: { name: `Updated User - ${player.name}`, icon_url: player.image },
        description:
            `\`  Discord Account \` : <@${discordID}>\n` +
            `\` Primary Riot IGN \` : [\`${player.PrimaryRiotAccount.riotIGN}\`](https://tracker.gg/valorant/profile/riot/${encodeURIComponent(player.PrimaryRiotAccount.riotIGN)})`
        ,
        color: 0xE92929,
        fields: [
            {
                name: `\u200B`,
                value:
                    `__**MMR Update Summary**__\n` +
                    `\`${String(oldMMR).padStart(4)} \` => \`${String(newMMR).padStart(4)} \``
                ,
                inline: false
            }
        ],
        footer: { text: `Valorant Draft Circuit — Update MMR` }
    });


    await interaction.editReply({ embeds: [embed] });
    return await interaction.followUp({ content: `Admin abuse? god you make me sick`, ephemeral: true })
}

module.exports = { updateMMR };