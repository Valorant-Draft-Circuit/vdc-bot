const { LeagueStatus } = require(`@prisma/client`);
const { Player, Transaction, Flags } = require(`../../../../prisma`);
const fs = require(`fs`);
const { ChatInputCommandInteraction, EmbedBuilder } = require(`discord.js`)


async function debugUser(/** @type ChatInputCommandInteraction */ interaction) {
    const { _subcommand, _hoistedOptions } = interaction.options;
    const debugUser = _hoistedOptions[0].user;

    const playerData = await Player.getBy({ discordID: debugUser.id });
    const primaryRiotAccount = playerData.PrimaryRiotAccount;
    const discordAccount = playerData.Accounts.find(a => a.provider === `discord`);
    const altAccounts = playerData.Accounts.filter(a => a.provider !== `discord` && a.id !== primaryRiotAccount.id);

    const status = playerData.Status;

    // build and then send the embed confirmation
    const embed = new EmbedBuilder({
        author: { name: `Debug User - ${playerData.name}`, icon_url: playerData.image },
        description:
            `\`  Discord Account \` : <@${discordAccount.providerAccountId}>\n` +
            `\` Primary Riot IGN \` : [\`${primaryRiotAccount.riotIGN}\`](https://tracker.gg/valorant/profile/riot/${encodeURIComponent(primaryRiotAccount.riotIGN)})`
        ,
        color: 0xE92929,
        fields: [
            {
                name: `\u200B`,
                value:
                    `__**Status**__\n` +
                    `\`      League Status \` : ${status.leagueStatus}\n` +
                    `\`    Contract Status \` : ${status.contractStatus}\n` +
                    `\` Contract Remaining \` : ${status.contractRemaining}`
                ,
                inline: false
            }
        ],
        footer: { text: `Valorant Draft Circuit — temp` }
    });

    fs.writeFileSync(`./cache/debug_${playerData.id}.json`, JSON.stringify(playerData, 4, ` `));
    await interaction.editReply({ embeds: [embed] });
    return await interaction.channel.send({ files: [`./cache/debug_${playerData.id}.json`] })
}

module.exports = { debugUser };