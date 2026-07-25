const { Player, ControlPanel } = require(`../../../../prisma`);
const { ChatInputCommandInteraction, EmbedBuilder, MessageFlags } = require(`discord.js`);
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
                    `\`${oldMMR}\` => \`${newMMR}\``
                ,
                inline: false
            }
        ],
        footer: { text: `Valorant Draft Circuit — Update MMR` }
    });

    logger.log(`INFO`, `${interaction.user} (\`${interaction.user.username}\`) updated MMR for ${guildMember} (\`${guildMember.username}\`) from \`${oldMMR}\` to \`${newMMR}\``);


    buildMMRCache();

    await interaction.editReply({ embeds: [embed] });
    // Commented out while doing queue testing as it just spams the chat.
    // return await interaction.followUp({ content: flavorResponses[i], flags: [MessageFlags.Ephemeral] })
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

    const mapped = [];
    for (const player of playerMMRs) {
        const discordAccount = player.Accounts[0];
        const mmrEffective = player.PrimaryRiotAccount?.MMR?.mmrEffective;

        const hasDiscordLink = discordAccount != null;
        const hasMMR = mmrEffective !== null && mmrEffective !== undefined;
        if (!hasDiscordLink || !hasMMR) continue;

        mapped.push({
            discordID: discordAccount.providerAccountId,
            mmr: mmrEffective,
            ls: player.Status?.leagueStatus,
            cs: player.Status?.contractStatus,
        });
    }

    const tierLines = await ControlPanel.getMMRCaps(`PLAYER`);

    fs.writeFileSync(`./cache/mmrCache.json`, JSON.stringify(mapped));
    fs.writeFileSync(`./cache/mmrTierLinesCache.json`, JSON.stringify({
        ...tierLines, pulled: new Date()
    }));
    return playerMMRs;
}