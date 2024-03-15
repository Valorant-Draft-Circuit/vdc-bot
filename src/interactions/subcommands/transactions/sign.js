const { ChatInputCommandInteraction, GuildMember } = require("discord.js");

const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require("discord.js");

/** Send confirmation to sign a player
 * @param {ChatInputCommandInteraction} interaction 
 * @param {GuildMember} player 
 * @param {String} team 
 */
async function requestSign(interaction, player, team) {
    await interaction.deferReply();
    const playerData = await Player.getBy({ discordID: player.value });
    const teamData = await Team.getBy({ name: teamName });
    const franchiseData = await Franchise.getBy({ id: teamData.franchise });


    // checks
    // if (playerData == undefined) return await interaction.editReply({ content: `This player doesn't exist!`, ephemeral: false });
    // if (playerData.status !== PlayerStatusCode.FREE_AGENT) return await interaction.editReply({ content: `This player is not a Free Agent and cannot be signed to ${teamData.name}!`, ephemeral: false });

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `Are you sure you perform the following action?`,
        color: 0xE92929,
        fields: [
            {
                name: `\u200B`,
                value: `**Transaction**\n\`  Player Tag: \`\n\`   Player ID: \`\n\`        Team: \`\n\`   Franchise: \``,
                inline: true
            },
            {
                name: `\u200B`,
                value: `SIGN\n${player.user}\n\`${player.value}\`\n${teamData.name}\n${franchiseData.name}`,
                inline: true
            }
        ],
        footer: { text: `Transactions — Sign` }
    });

    const cancel = new ButtonBuilder({
        customId: `transactions_${TransactionsSignOptions.CANCEL}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
    })

    const confirm = new ButtonBuilder({
        customId: `transactions_${TransactionsSignOptions.CONFIRM}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
    })

    // create the action row, add the component to it & then editReply with all the data
    const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
    return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

/** Confirm signing a player
 * @param {ChatInputCommandInteraction} interaction
 */
async function confirmSign(interaction) {
    await interaction.deferReply({ ephemeral: true }); // defer as early as possible

    const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
    const playerID = data[2];

    const playerData = await Player.getBy({ discordID: playerID });
    const playerIGN = await Player.getIGNby({ discordID: playerID });
    const teamData = await Team.getBy({ name: data[3] });
    const franchiseData = await Franchise.getBy({ name: data[4] });

    const playerTag = playerIGN.split(`#`)[0];
    const guildMember = await interaction.guild.members.fetch(playerID);
    const accolades = guildMember.nickname?.match(emoteregex);

    // add the franchise role, remove FA/RFA role
    if (!guildMember._roles.includes(franchiseData.roleID)) await guildMember.roles.add(franchiseData.roleID);
    if (guildMember._roles.includes(ROLES.LEAGUE.FREE_AGENT)) await guildMember.roles.remove(ROLES.LEAGUE.FREE_AGENT);
    if (guildMember._roles.includes(ROLES.LEAGUE.RESTRICTED_FREE_AGENT)) await guildMember.roles.remove(ROLES.LEAGUE.RESTRICTED_FREE_AGENT);

    // update nickname
    guildMember.setNickname(`${franchiseData.slug} | ${playerTag} ${accolades ? accolades.join(``) : ``}`);

    // cut the player & ensure that the player's team property is now null
    const player = await Transaction.sign({ playerID: playerData.id, teamID: teamData.id });
    if (player.team !== teamData.id) return await interaction.editReply({ content: `There was an error while attempting to sign the player. The database was not updated.` });

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);
    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);
    await interaction.message.edit({ embeds: [embedEdits], components: [] });

    // create the base embed
    const announcement = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `${guildMember} (${playerTag}) was signed to ${franchiseData.name}`,
        thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}` },
        color: 0xE92929,
        fields: [
            {
                name: `Franchise`,
                value: `<${franchiseData.emoteID}> ${franchiseData.name}`,
                inline: true
            },
            {
                name: `Team`,
                value: teamData.name,
                inline: true
            },
        ],
        footer: { text: `Transactions — Sign` },
        timestamp: Date.now(),
    });

    await interaction.deleteReply();
    return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}

module.exports = {
    requestSign: requestSign,
    confirmSign: confirmSign
}