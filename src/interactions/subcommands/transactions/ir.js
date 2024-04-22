const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ChatInputCommandInteraction, GuildMember } = require(`discord.js`);


const { Franchise, Player, Team, Transaction } = require(`../../../../prisma`);
const { ROLES, CHANNELS, TransactionsNavigationOptions } = require(`../../../../utils/enums`);
const { ContractStatus } = require("@prisma/client");

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

/** Send confirmation to IR a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 */
async function requestIR(interaction, player) {
	const playerData = await Player.getBy({ discordID: player.value });

	// checks
	if (playerData === null) return interaction.editReply(`This player doesn't exist!`);
	if (playerData.team === null) return interaction.editReply(`This player is not on a team and cannot be placed on Inactive Reserve!`);


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
		footer: { text: `Transactions — Inactive Reserve` },
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

	if (playerData.Status.contractStatus === ContractStatus.INACTIVE_RESERVE) {
		// REMOVE A USER FROM INACTIVE RESERVE
		embed.addFields({
			name: `\u200B`,
			value: `REMOVE IR\n${player.user}\n\`${player.value}\`\n${teamData.name}\n${franchiseData.name}`,
			inline: true,
		});
		confirm.setCustomId(`transactions_${TransactionsNavigationOptions.IR_REMOVE_COMFIRM}`);

	} else {
		// PLACE A USER ON INACTIVE RESERVE
		embed.addFields({
			name: `\u200B`,
			value: `PLACE IR\n${player.user}\n\`${player.value}\`\n${teamData.name}\n${franchiseData.name}`,
			inline: true,
		});
		confirm.setCustomId(`transactions_${TransactionsNavigationOptions.IR_SET_COMFIRM}`);

	}

	// create the action row, add the component to it & then reply with all the data
	const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
	return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

/** Send confirmation to IR a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {`SET`|`REMOVE`} mode
 */
async function confirmToggleIR(interaction, mode) {
	const playerID = interaction.message.embeds[0].fields[1].value
		.replaceAll(`\``, ``)
		.split(`\n`)[2];

	const playerData = await Player.getBy({ discordID: playerID });
	const playerIGN = await Player.getIGNby({ discordID: playerID });
	const guildMember = await interaction.guild.members.fetch(playerID);
	const team = await Team.getBy({ id: playerData.team });

	const playerTag = playerIGN.split(`#`)[0];

	if (mode === `SET`) await guildMember.roles.add(ROLES.LEAGUE.INACTIVE_RESERVE);
	else await guildMember.roles.remove(ROLES.LEAGUE.INACTIVE_RESERVE);

	// cut the player & ensure that the player's team property is now null
	const player = await Transaction.toggleInactiveReserve({
		playerID: playerData.id,
		toggle: mode,
	});
	if (player.Status.contractStatus !== ContractStatus.INACTIVE_RESERVE && mode == `SET`) return await interaction.editReply(`There was an error while attempting to place the player on Inactive Reserve. The database was not updated.`);
	if (player.Status.contractStatus === ContractStatus.INACTIVE_RESERVE && mode == `REMOVE`) return await interaction.editReply(`There was an error while attempting to remove the player from Inactive Reserve. The database was not updated.`);

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
		footer: { text: `Transactions — Inactive Reserve` },
		timestamp: Date.now(),
	});

	if (mode === `SET`) announcement.setDescription(`${guildMember} (${playerTag}) has been placed on Inactive Reserve`)
	else announcement.setDescription(`${guildMember} (${playerTag}) is no longer on Inactive Reserve`)

	await interaction.deleteReply();
	const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
	return await transactionsChannel.send({ embeds: [announcement] });
}

module.exports = {
	requestIR: requestIR,
	confirmToggleIR: confirmToggleIR,
};
