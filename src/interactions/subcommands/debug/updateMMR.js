const { Player, ControlPanel } = require(`../../../../prisma`);
const { ChatInputCommandInteraction, EmbedBuilder } = require(`discord.js`);
const { prisma } = require("../../../../prisma/prismadb");
const fs = require(`fs`);

const flavorResponses = [
    `Admin abuse? god you make me sick`,
    `Changing MMR? you dirty dirty little admin`,
    `interesting. are you sure you wanted to do that?`,
    `the league WILL hear about this.`,
    `how will they play with their edater now????`
];

async function updateMMR(/** @type ChatInputCommandInteraction */ interaction) {
    const { _subcommand, _hoistedOptions } = interaction.options;

    const i = Math.floor(Math.random() * flavorResponses.length);

    const guildMember = _hoistedOptions[0].user;
    const newMMR = _hoistedOptions[1].value;

    const player = await Player.getBy({ discordID: _hoistedOptions[0].user.id });
	if (player == null) return await interaction.editReply(`This player (${guildMember}, \`${guildMember.username}\`, \`${guildMember.id}\`) does not exist in our database!`);

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
                    `\`${oldMMR} \` => \`${newMMR}\``
                ,
                inline: false
            }
        ],
        footer: { text: `Valorant Draft Circuit — Update MMR` }
    });

    logger.log(`INFO`, `${interaction.user} (${interaction.user.username}) updated MMR for ${guildMember} (${guildMember.username}) from \`${oldMMR}\` to \`${newMMR}\``);


    buildMMRCache();

    await interaction.editReply({ embeds: [embed] });
    return await interaction.followUp({ content: flavorResponses[i], ephemeral: true })
}

module.exports = { updateMMR };


/** Query the database to get MMRs */
async function buildMMRCache() {
    const playerMMRs = await prisma.user.findMany({
        include: {
            Accounts: { where: { provider: `discord` } },
            PrimaryRiotAccount: { include: { MMR: true } },
            Status: true
        }
    });

    const mapped = playerMMRs.map((p) => {
        const disc = p.Accounts[0].providerAccountId;
        const mmr = p.PrimaryRiotAccount?.MMR?.mmrEffective;
        return { discordID: disc, mmr: mmr, ls: p.Status.leagueStatus, cs: p.Status.contractStatus};
    }).filter((p => p.mmr !== null && p.mmr !== undefined));

    const tierLines = await ControlPanel.getMMRCaps(`PLAYER`);

    fs.writeFileSync(`./cache/mmrCache.json`, JSON.stringify(mapped));
    fs.writeFileSync(`./cache/mmrTierLinesCache.json`, JSON.stringify({
        ...tierLines, pulled: new Date()
    }));
    return playerMMRs;
}