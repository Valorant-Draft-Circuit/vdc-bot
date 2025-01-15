const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ChatInputCommandInteraction, GuildMember } = require(`discord.js`);


const { Franchise, Player, Team, Transaction } = require(`../../../../prisma`);
const { ROLES, CHANNELS, TransactionsNavigationOptions } = require(`../../../../utils/enums`);
const { LeagueStatus } = require("@prisma/client");
const { prisma } = require("../../../../prisma/prismadb");

const Logger = require("../../../core/logger");
const logger = new Logger();

const imagepath = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/`;
const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

/** Send confirmation to sign a player
 * @param {ChatInputCommandInteraction} interaction 
 * @param {GuildMember} player 
 * @param {String} team 
 */
async function requestSign(interaction, player, teamName) {

	const playerData = await Player.getBy({ discordID: player.value });
	const team = await Team.getBy({ name: teamName });
	const franchise = team.Franchise;

	// checks
	if (playerData === null) return interaction.editReply(`This player doesn't exist!`);
	if (playerData.Status.leagueStatus !== LeagueStatus.FREE_AGENT && playerData.Status.leagueStatus !== LeagueStatus.GENERAL_MANAGER) return await interaction.editReply(`This player is not a Free Agent or a GM and cannot be signed to ${team.name}!`);

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
				value: `SIGN\n${player.user}\n\`${player.value}\`\n${team.name}\n${franchise.name}`,
				inline: true
			}
		],
		footer: { text: `Transactions — Sign` }
	});

	const cancel = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.CANCEL}`,
		label: `Cancel`,
		style: ButtonStyle.Danger,
	})

	const confirm = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.SIGN_COMFIRM}`,
		label: `Confirm`,
		style: ButtonStyle.Success,
	})

	// create the action row, add the component to it & then reply with all the data
	const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
	return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

/** Confirm signing a player
 * @param {ChatInputCommandInteraction} interaction
 */
async function confirmSign(interaction) {

	const data = interaction.message.embeds[0].fields[1].value.replaceAll(`\``, ``).split(`\n`);
	const playerID = data[2];

	const playerData = await Player.getBy({ discordID: playerID });
	const playerIGN = await Player.getIGNby({ discordID: playerID });
	const team = await Team.getBy({ name: data[3] });
	const franchise = await Franchise.getBy({ teamID: team.id });


	// update nickname
	const playerTag = playerIGN.split(`#`)[0];
	const guildMember = await interaction.guild.members.fetch(playerID);
	const accolades = guildMember.nickname?.match(emoteregex);

	guildMember.setNickname(`${franchise.slug} | ${playerTag} ${accolades ? accolades.join(``) : ``}`);

	// remove all league roles and then add League & franchise role
	const franchiseRoleIDs = (await prisma.franchise.findMany({ where: { active: true } })).map(f => f.roleID);
	await guildMember.roles.remove([
		...Object.values(ROLES.LEAGUE),
		...Object.values(ROLES.TIER),
		...franchiseRoleIDs
	]);
	await guildMember.roles.add([
		ROLES.LEAGUE.LEAGUE,
		ROLES.TIER[team.tier],
		franchise.roleID
	]);

	// sign the player & ensure that the player's team property is now null
	const isGM = playerData.Status.leagueStatus === LeagueStatus.GENERAL_MANAGER;
	const player = await Transaction.sign({ userID: playerData.id, teamID: team.id, isGM: isGM });
	if (player.team !== team.id) return await interaction.editReply({ content: `There was an error while attempting to sign the player. The database was not updated.` });

	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);
	embedEdits.setDescription(`This operation was successfully completed.`);
	embedEdits.setFields([]);
	await interaction.message.edit({ embeds: [embedEdits], components: [] });

	// create the base embed
	const announcement = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `${guildMember} (${playerTag}) has been signed to ${franchise.name}`,
		thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${team.Franchise.Brand.logo}` },
		color: 0xE92929,
		fields: [
			{
				name: `Franchise`,
				value: `<${franchise.Brand.discordEmote}> ${team.Franchise.name}`,
				inline: true,
			},
			{
				name: `Team`,
				value: team.name,
				inline: true,
			},
		],
		footer: { text: `Transactions — Sign` },
		timestamp: Date.now(),
	});

	// Attempt to send a message to the user once they are cut
	try {
		const fchse = await prisma.franchise.findFirst({
			where: { id: franchise.id },
			include: {
				Teams: true, Brand: true,
				GM: { include: { Accounts: true } },
				AGM1: { include: { Accounts: true } },
				AGM2: { include: { Accounts: true } },
				AGM3: { include: { Accounts: true } },
			}
		});

		const gmIDs = [
            fchse.GM?.Accounts.find(a => a.provider == `discord`).providerAccountId,
        ].filter(v => v !== undefined);

        const agmIDs = [
            fchse.AGM1?.Accounts.find(a => a.provider == `discord`).providerAccountId,
            fchse.AGM2?.Accounts.find(a => a.provider == `discord`).providerAccountId,
            fchse.AGM3?.Accounts.find(a => a.provider == `discord`).providerAccountId
        ].filter(v => v !== undefined);


		const dmEmbed = new EmbedBuilder({
			description: `Congratulations, you've been signed to ${franchise.name}! Make sure you join the franchise server using the link below- best of luck to you and your new team!\n\n Your new GM is ${gmIDs.map(gm => `<@${gm}>`)} & AGM(s) are ${agmIDs.map(agm => `<@${agm}>`)}. Feel free to reach out to them if you have any more questions!`,
			thumbnail: { url: `${imagepath}${franchise.Brand.logo}` },
			color: Number(franchise.Brand.colorPrimary)
		});

		// create the action row and add the button to it
		const dmRow = new ActionRowBuilder({
			components: [
				new ButtonBuilder({
					label: `${franchise.name} Discord`,
					style: ButtonStyle.Link,
					url: franchise.Brand.urlDiscord
				})
			]
		});
		await guildMember.send({ embeds: [dmEmbed], components: [dmRow] });

	} catch (e) {
		logger.log(`WARNING`, `User ${player.name} does not have DMs open & will not receive the sign message`);
	}

	await interaction.deleteReply();
	const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
	return await transactionsChannel.send({ embeds: [announcement] });
}

module.exports = {
	requestSign: requestSign,
	confirmSign: confirmSign
}