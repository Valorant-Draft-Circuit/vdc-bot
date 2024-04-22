const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ChatInputCommandInteraction, GuildMember } = require(`discord.js`);


const { Player, Transaction } = require(`../../../../prisma`);
const { ROLES, CHANNELS, TransactionsNavigationOptions } = require(`../../../../utils/enums`);
const { prisma } = require("../../../../prisma/prismadb");
const { LeagueStatus } = require("@prisma/client");

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

/** Send confirmation to Retire a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 */
async function requestRetire(interaction, player) {
	const playerData = await Player.getBy({ discordID: player.value });

	// checks
	if (playerData === null) return interaction.editReply(`This player doesn't exist!`);


	// create the base embed
	const embed = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `Are you sure you perform the following action?`,
		color: 0xe92929,
		fields: [
			{
				name: `\u200B`,
				value: `**Transaction**\n\`  Player Tag: \`\n\`   Player ID: \``,
				inline: true,
			},
			{
				name: `\u200B`,
				value: `RETIRE\n${player.user}\n\`${player.value}\``,
				inline: true,
			},
		],
		footer: { text: `Transactions — Retire` },
	});

	const cancel = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.CANCEL}`,
		label: `Cancel`,
		style: ButtonStyle.Danger,
	});

	const confirm = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.RETIRE_COMFIRM}`,
		label: `Confirm`,
		style: ButtonStyle.Success,
	});

	// create the action row, add the component to it & then reply with all the data
	const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
	return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmRetire(interaction) {

	const playerID = interaction.message.embeds[0].fields[1].value
		.replaceAll(`\``, ``)
		.split(`\n`)[2];

	const playerData = await Player.getBy({ discordID: playerID });
	const playerIGN = await Player.getIGNby({ discordID: playerID });
	const guildMember = await interaction.guild.members.fetch(playerID);

	const franchiseRoleIDs = (await prisma.franchise.findMany()).map(f => f.roleID);

	// get player info (IGN, Accolades) & update their nickname
	const playerTag = playerIGN.split(`#`)[0];
	const accolades = guildMember.nickname?.match(emoteregex);
	guildMember.setNickname(`${playerTag} ${accolades ? accolades.join(``) : ``}`);

	// remove all league roles and then add League & franchise role
	await guildMember.roles.remove(
		...Object.values(ROLES.LEAGUE),
		...Object.values(ROLES.TIER),
		...franchiseRoleIDs
	);
	await guildMember.roles.add(ROLES.LEAGUE.FORMER_PLAYER);

	const retiredPlayer = await Transaction.retire(playerID);
	if (retiredPlayer.User.Status.leagueStatus !== LeagueStatus.RETIRED) return await interaction.editReply(`There was an error while attempting to retire the player. The database was not updated.`);

	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);
	embedEdits.setDescription(`This operation was successfully completed.`);
	embedEdits.setFields([]);
	await interaction.message.edit({ embeds: [embedEdits], components: [] });

	// create the base embed
	const announcement = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `${guildMember} (${playerTag}) is retiring from the league`,
		color: 0xe92929,
		footer: { text: `Transactions — Retire` },
		timestamp: Date.now(),
	});

	await interaction.deleteReply();
	const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
	return await transactionsChannel.send({ embeds: [announcement] });
}
module.exports = {
	requestRetire: requestRetire,
	confirmRetire: confirmRetire,
};
