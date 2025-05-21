const { Player, Flags } = require(`../../../../prisma`);
const fs = require(`fs`);
const { ChatInputCommandInteraction, EmbedBuilder } = require(`discord.js`)


async function debugUser(/** @type ChatInputCommandInteraction */ interaction) {
    const { _subcommand, _hoistedOptions } = interaction.options;
    const debugUser = _hoistedOptions[0].user;

    const player = await Player.getBy({ discordID: _hoistedOptions[0].user.id });
	if (player == null) return await interaction.editReply(`This player (${debugUser}, \`${debugUser.username}\`, \`${debugUser.id}\`) does not exist in our database!`);

    const primaryRiotAccount = player.PrimaryRiotAccount;
    const discordAccount = player.Accounts.find(a => a.provider === `discord`);
    // const altAccounts = player.Accounts.filter(a => a.provider !== `discord` && a.id !== primaryRiotAccount.id);

    const status = player.Status;

    // build and then send the embed confirmation
    const embed = new EmbedBuilder({
        author: { name: `Debug User - ${player.name}`, icon_url: player.image },
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

    fs.writeFileSync(`./cache/debug_${player.id}.json`, JSON.stringify(player, 4, ` `));
    await interaction.editReply({ embeds: [embed] });
    return await interaction.channel.send({ files: [`./cache/debug_${player.id}.json`] })
}

module.exports = { debugUser };