const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ChatInputCommandInteraction, GuildMember } = require(`discord.js`);


const { Franchise, Player, Team, Transaction } = require(`../../../../prisma`);
const { ROLES, CHANNELS, TransactionsNavigationOptions } = require(`../../../../utils/enums`);

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

/** Request confirmation to cut a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 */
async function requestCut(interaction, player) {
	const playerData = await Player.getBy({ discordID: player.value });

	// checks
	if (playerData === null) return interaction.editReply(`This player doesn't exist!`);
	if (playerData.team === null) return interaction.editReply(`This player is not signed to a team and cannot have their contract renewed!`);

	// get the player's franchise and team
	const franchise = await Franchise.getBy({ teamID: playerData.team });
	const team = await Team.getBy({ id: playerData.team });

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
			{
				name: `\u200B`,
				value: `CUT\n${player.user}\n\`${player.value}\`\n${team.name}\n${franchise.name}`,
				inline: true,
			},
		],
		footer: { text: `Transactions — Cut` },
	});

	const cancel = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.CANCEL}`,
		label: `Cancel`,
		style: ButtonStyle.Danger,
	});

	const confirm = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.CUT_CONFIRM}`,
		label: `Confirm`,
		style: ButtonStyle.Success,
	});

	// create the action row, add the component to it & then reply with all the data
	const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
	return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmCut(interaction) {

	const playerID = interaction.message.embeds[0].fields[1].value
		.replaceAll(`\``, ``)
		.split(`\n`)[2];

	const playerData = await Player.getBy({ discordID: playerID });
	const playerIGN = await Player.getIGNby({ discordID: playerID });
	const guildMember = await interaction.guild.members.fetch(playerID);
	const team = await Team.getBy({ id: playerData.team });


	// remove the franchise role and update their nickname
	const franchiseRoleID = team.Franchise;
	if (guildMember._roles.includes(franchiseRoleID)) await guildMember.roles.remove(franchiseRoleID);
	await guildMember.roles.add(ROLES.LEAGUE.FREE_AGENT);


	// get player info (IGN, Accolades) & update their nickname
	const playerTag = playerIGN.split(`#`)[0];
	const accolades = guildMember.nickname?.match(emoteregex);
	guildMember.setNickname(`FA | ${playerTag} ${accolades ? accolades.join(``) : ``}`);

	// cut the player & ensure that the player's team property is now null
	const player = await Transaction.cut(playerID);
	if (player.User.team !== null) {
		return await interaction.editReply({
			content: `There was an error while attempting to cut the player. The database was not updated.`,
		});
	}

	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);
	embedEdits.setDescription(`This operation was successfully completed.`);
	embedEdits.setFields([]);
	await interaction.message.edit({ embeds: [embedEdits], components: [] });

	// create the base embed
	const announcement = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `${guildMember} (${playerTag}) was cut from ${team.Franchise.name}`,
		thumbnail: {
			url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${team.Franchise.Brand.logo}`,
		},
		color: 0xe92929,
		fields: [
			{
				name: `Franchise`,
				value: `<${team.Franchise.Brand.discordEmote}> ${team.Franchise.name}`,
				inline: true,
			},
			{
				name: `Team`,
				value: team.name,
				inline: true,
			},
		],
		footer: { text: `Transactions — CUT` },
		timestamp: Date.now(),
	});

	await interaction.deleteReply();
	const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
	return await transactionsChannel.send({ embeds: [announcement] });
}

module.exports = {
	requestCut: requestCut,
	confirmCut: confirmCut,
};
