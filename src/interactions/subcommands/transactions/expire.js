const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ChatInputCommandInteraction, GuildMember } = require(`discord.js`);


const { Player, Team, Transaction, Franchise, Flags } = require(`../../../../prisma`);
const { ROLES, CHANNELS, TransactionsNavigationOptions } = require(`../../../../utils/enums`);
const { prisma } = require("../../../../prisma/prismadb");
const { Tier } = require("@prisma/client");


const Logger = require("../../../core/logger");
const { updateMeilisearchPlayer } = require("../../../../utils/web/vdcWeb");
const logger = new Logger();

const imagepath = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/`;

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

/** Send confirmation to Renew a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 * @param {String} teamName
 */
async function requestExpire(interaction, player) {

	const playerData = await Player.getBy({ discordID: player.value });
	if (playerData === null) return interaction.editReply(`This player doesn't exist!`);
	if (playerData.team === null) return interaction.editReply(`This player is not signed to a team and cannot have their contract expiration finalized!`);
	if (playerData.Status.contractRemaining !== 0) return interaction.editReply(`This player's contract isn't expiring and cannot have their contract expiration finalized!`);


	const teamData = await Team.getBy({ id: playerData.team });
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
				value: `FINALIZE EXPIRATION\n${player.user}\n\`${player.value}\`\n${teamData.name}\n${franchise.name}`,
				inline: true,
			},
		],
		footer: { text: `Transactions — Expire` },
	});

	const cancel = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.CANCEL}`,
		label: `Cancel`,
		style: ButtonStyle.Danger,
	});

	const confirm = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.EXPIRE_COMFIRM}`,
		label: `Confirm`,
		style: ButtonStyle.Success,
	});

	// create the action row, add the component to it & then reply with all the data
	const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
	return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmExpire(interaction) {

	const playerID = interaction.message.embeds[0].fields[1].value
		.replaceAll(`\``, ``)
		.split(`\n`)[2];

	const playerData = await Player.getBy({ discordID: playerID });
	const playerIGN = await Player.getIGNby({ discordID: playerID });
	const guildMember = await interaction.guild.members.fetch(playerID);

	const team = await Team.getBy({ id: playerData.team });
	const franchise = await Franchise.getBy({ teamID: playerData.team });

	const playerTag = playerIGN.split(`#`)[0];

	// remove all league roles and then add League & franchise role
	const franchiseRoleIDs = (await prisma.franchise.findMany({ where: { active: true } })).map(f => f.roleID);
	await guildMember.roles.remove([
		...Object.values(ROLES.LEAGUE),
		...Object.values(ROLES.TIER),
		...franchiseRoleIDs
	]);

	const flags = await Player.getFlags({ userID: playerData.id });
	let agentType = flags == BigInt(Flags.REGISTERED_AS_RFA) ? `RFA` : `FA`;

	await guildMember.roles.add([ROLES.LEAGUE.LEAGUE, agentType == `RFA` ? ROLES.LEAGUE.RESTRICTED_FREE_AGENT : ROLES.LEAGUE.FREE_AGENT]);
	switch (team.tier) {
		case Tier.RECRUIT:
			await guildMember.roles.add(ROLES.TIER.RECRUIT_FREE_AGENT);
			break;
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
	const accolades = guildMember.nickname?.match(emoteregex);
	guildMember.setNickname(`${agentType} | ${playerTag} ${accolades ? accolades.join(``) : ``}`);

	// cut the player & ensure that the player's team property is now null
	const status = await Transaction.cut(playerID);
	if (status.contractRemaining != null) return await interaction.editReply(`There was an error while attempting to finalize the expiration of the player's contract. The database was not updated.`);

	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);
	embedEdits.setDescription(`This operation was successfully completed.`);
	embedEdits.setFields([]);
	await interaction.message.edit({ embeds: [embedEdits], components: [] });

	// create the base embed
	const announcement = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `${guildMember} (${playerTag})'s contract on ${franchise.name} has expired`,
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
		footer: { text: `Transactions — Expire` },
		timestamp: Date.now(),
	});

	// Attempt to send a message to the user once they are cut
	try {
		const dmEmbed = new EmbedBuilder({
			description: `Unfortunately, your contract with ${franchise.name} has expired but that's not the end! If you want to stay involved & showcase your talent to other teams-- as well as showing your old team that they would've been way better off with you on it... Join the FA Hub!`,
			thumbnail: { url: `${imagepath}${franchise.Brand.logo}` },
			color: Number(franchise.Brand.colorPrimary)
		});

		// create the action row and add the button to it
		const dmRow = new ActionRowBuilder({
			components: [
				new ButtonBuilder({
					label: `Free Agent Hub`,
					style: ButtonStyle.Link,
					url: `https://go.vdc.gg/fahub`
				})
			]
		});
		await guildMember.send({ embeds: [dmEmbed], components: [dmRow] });

	} catch (e) {
		logger.log(`WARNING`, `User ${player.name} does not have DMs open & will not receive the contract expiration message`);
	}

	// lastly, update meilisearch to contain their new information
	await updateMeilisearchPlayer(playerData.id)

	await interaction.deleteReply();
	const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
	return await transactionsChannel.send({ embeds: [announcement] });
}
module.exports = {
	requestExpire: requestExpire,
	confirmExpire: confirmExpire,
};
