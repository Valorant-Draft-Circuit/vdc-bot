const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ChatInputCommandInteraction, GuildMember, ButtonInteraction } = require(`discord.js`);


const { Franchise, Player, Team, Transaction } = require(`../../../../prisma`);
const { ROLES, CHANNELS, TransactionsNavigationOptions } = require(`../../../../utils/enums`);
const { Tier } = require("@prisma/client");
const { prisma } = require("../../../../prisma/prismadb");

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
	if (playerData.Captain !== null) return interaction.editReply(`This player is the team captain. Please remove them as a captain before you cut them.`);

	// get the player's franchise and team
	const team = await Team.getBy({ id: playerData.team });
	const franchise = await Franchise.getBy({ teamID: playerData.team });

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

async function confirmCut(/** @type ButtonInteraction */ interaction) {

	const playerID = interaction.message.embeds[0].fields[1].value
		.replaceAll(`\``, ``)
		.split(`\n`)[2];

	const playerData = await Player.getBy({ discordID: playerID });
	const playerIGN = await Player.getIGNby({ discordID: playerID });
	const guildMember = await interaction.guild.members.fetch(playerID);
	const team = await Team.getBy({ id: playerData.team });
	const franchise = await Franchise.getBy({ teamID: team.id });

	// remove all league roles and then add League & franchise role
	const franchiseRoleIDs = (await prisma.franchise.findMany({ where: { active: true } })).map(f => f.roleID);
	await guildMember.roles.remove([
		...Object.values(ROLES.LEAGUE),
		...Object.values(ROLES.TIER),
		...franchiseRoleIDs
	]);
	await guildMember.roles.add([ROLES.LEAGUE.LEAGUE, ROLES.LEAGUE.FREE_AGENT]);
	switch (team.tier) {
		case Tier.PROSPECT:
			await guildMember.roles.add(ROLES.TIER.PROSPECT_FREE_AGENT);
			break;
		case Tier.APPRENTICE:
			await guildMember.roles.add(ROLES.TIER.APPRENTICE_FREE_AGENT);
			break;
		case Tier.EXPERT:
			await guildMember.roles.add(ROLES.TIER.EXPERT_FREE_AGENT);
			break;
		case Tier.MYTHIC:
			await guildMember.roles.add(ROLES.TIER.MYTHIC_FREE_AGENT);
			break;
	}

	// get player info (IGN, Accolades) & update their nickname
	const playerTag = playerIGN.split(`#`)[0];
	const accolades = guildMember.nickname?.match(emoteregex);
	guildMember.setNickname(`FA | ${playerTag} ${accolades ? accolades.join(``) : ``}`);

	// cut the player & ensure that the player's team property is now null
	const player = await Transaction.cut(playerID);
	if (player.User.team !== null) return await interaction.editReply(`There was an error while attempting to cut the player. The database was not updated.`);

	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);
	embedEdits.setDescription(`This operation was successfully completed.`);
	embedEdits.setFields([]);
	await interaction.message.edit({ embeds: [embedEdits], components: [] });

	// create the base embed
	const announcement = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `${guildMember} (${playerTag}) was cut from ${franchise.name}`,
		thumbnail: {
			url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchise.Brand.logo}`,
		},
		color: 0xe92929,
		fields: [
			{
				name: `Franchise`,
				value: `<${franchise.Brand.discordEmote}> ${franchise.name}`,
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
