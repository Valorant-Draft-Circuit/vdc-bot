const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ChatInputCommandInteraction, GuildMember } = require(`discord.js`);


const { Franchise, Player, Team, Transaction, Roles } = require(`../../../../prisma`);
const { ROLES, CHANNELS, TransactionsNavigationOptions } = require(`../../../../utils/enums`);
const { ContractStatus } = require("@prisma/client");

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

/** Send confirmation to IR a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 */
async function requestCaptain(interaction, player) {
	const playerData = await Player.getBy({ discordID: player.value });

	// checks
	if (playerData === null) return interaction.editReply(`This player doesn't exist!`);
	if (playerData.team === null) return interaction.editReply(`This player is not on a team and cannot be set as a team captain!`);

	const teamData = await Team.getBy({ id: playerData.team });
	const franchiseData = await Franchise.getBy({ id: teamData.franchise });

	// create the base embed
	const embed = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `Are you sure you perform the following action?`,
		color: 0xe92929,
		fields: [
			{
				name: `\u200B`,
				value: `**Transaction**\n\`  Player Tag: \`\n\`   Player ID: \`\n\`        Team: \`\n\`   Franchise: \``,
				inline: true,
			},
		],
		footer: { text: `Transactions — Team Captain` },
	});

	const cancel = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.CANCEL}`,
		label: `Cancel`,
		style: ButtonStyle.Danger,
	});

	const confirm = new ButtonBuilder({
		label: `Confirm`,
		style: ButtonStyle.Success,
	});

	if (teamData.Captain != null) {
		if (teamData.captain !== playerData.id) return await interaction.editReply(`This player isn't the captain for their team and cannot be removed!`);
		// REMOVE A TEAM CAPTAIN
		embed.addFields({
			name: `\u200B`,
			value: `REMOVE TEAM CAPTAIN\n${player.user}\n\`${player.value}\`\n${teamData.name}\n${franchiseData.name}`,
			inline: true,
		});
		confirm.setCustomId(`transactions_${TransactionsNavigationOptions.CAPTAIN_REMOVE_COMFIRM}`);

	} else {
		// SET A TEAM CAPTAIN
		embed.addFields({
			name: `\u200B`,
			value: `SET TEAM CAPTAIN\n${player.user}\n\`${player.value}\`\n${teamData.name}\n${franchiseData.name}`,
			inline: true,
		});
		confirm.setCustomId(`transactions_${TransactionsNavigationOptions.CAPTAIN_SET_COMFIRM}`);
	}

	// create the action row, add the component to it & then reply with all the data
	const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
	return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

/** Send confirmation to togglr Captain on a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {`SET`|`REMOVE`} mode
 */
async function confirmToggleCaptain(interaction, mode) {

	const playerID = interaction.message.embeds[0].fields[1].value
		.replaceAll(`\``, ``)
		.split(`\n`)[2];

	const playerData = await Player.getBy({ discordID: playerID });
	const playerIGN = await Player.getIGNby({ discordID: playerID });
	const guildMember = await interaction.guild.members.fetch(playerID);
	const team = await Team.getBy({ id: playerData.team });

	const playerTag = playerIGN.split(`#`)[0];

	if (mode === `SET`) await guildMember.roles.add(ROLES.LEAGUE.CAPTAIN);
	else await guildMember.roles.remove(ROLES.LEAGUE.CAPTAIN);

	// uncaptain the player & ensure that the player's Captain property is now null
	const updatedTeam = await Transaction.toggleCaptain({
		teamID: team.id,
		playerID: playerData.id,
		toggle: mode,
	});
	await Player.modifyRoles({ userID: playerData.id }, mode, [Roles.LEAGUE_CAPTAIN]);
	if (updatedTeam.captain === null && mode == `SET`) return await interaction.editReply(`There was an error while attempting to set the player as a captain. The database was not updated.`);
	if (updatedTeam.captain !== null && mode == `REMOVE`) return await interaction.editReply(`There was an error while attempting to remove the player as a captain. The database was not updated.`);

	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);
	embedEdits.setDescription(`This operation was successfully completed.`);
	embedEdits.setFields([]);
	await interaction.message.edit({ embeds: [embedEdits], components: [] });

	// create the base embed
	const announcement = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		thumbnail: {
			url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${team.Franchise.Brand.logo}`,
		},
		color: 0xe92929,
		footer: { text: `Transactions — Team Captain` },
		timestamp: Date.now(),
	});

	if (mode === `SET`) announcement.setDescription(`${guildMember} (${playerTag}) is now the captain for ${updatedTeam.name}`)
	else announcement.setDescription(`${guildMember} (${playerTag}) is no longer the captain for ${updatedTeam.name}`)

	await interaction.deleteReply();
	const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
	return await transactionsChannel.send({ embeds: [announcement] });
}

module.exports = {
	requestCaptain: requestCaptain,
	confirmToggleCaptain: confirmToggleCaptain,
};
