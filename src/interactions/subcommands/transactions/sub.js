const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ChatInputCommandInteraction, GuildMember } = require(`discord.js`);


const { Franchise, Player, Team, Transaction, ControlPanel } = require(`../../../../prisma`);
const { CHANNELS, TransactionsNavigationOptions } = require(`../../../../utils/enums`);
const { LeagueStatus, ContractStatus } = require("@prisma/client");

const sum = (array) => array.reduce((s, v) => s += v == null ? 0 : v, 0);

// const activeSubTime = 10; // conversion to milliseconds
const activeSubTime = 8 /* Hours a sub is active for the team */ * 60 * 60 * 1000; // conversion to milliseconds

async function requestSub(
	/** @type ChatInputCommandInteraction */ interaction,
	/** @type GuildMember */ subIn,
	/** @type GuildMember */ subOut
) {
	const subInData = await Player.getBy({ discordID: subIn.id });
	const subOutData = await Player.getBy({ discordID: subOut.id });

	if (subInData === undefined) return await interaction.editReply(`The player you're trying to sub in doesn't exist in the database!`);
	if (subOutData === undefined) return await interaction.editReply(`The player you're trying to sub out doesn't exist in the database!`);
	if (subOutData.team == null) return await interaction.editReply(`The player you're trying to sub out isn't on a team!`);


	const team = await Team.getBy({ id: subOutData.team });
	const roster = (await Team.getRosterBy({ id: subOutData.team })).roster
		.filter(player => player.Status.contractStatus === ContractStatus.SIGNED);
	const franchise = await Franchise.getBy({ id: team.franchise });

	const oldMMR = sum(roster.map((p) => p.PrimaryRiotAccount.MMR.mmrEffective));
	const rosterWithoutSubOut = roster.filter((p) => p.id !== subOutData.id)
	const mmrWithoutSubOut = sum(rosterWithoutSubOut.map((p) => p.PrimaryRiotAccount.MMR.mmrEffective));
	const newMMR = mmrWithoutSubOut + subInData.PrimaryRiotAccount.MMR.mmrEffective;

	const unsubTime = Math.round(Date.now() / 1000) + activeSubTime / 1000;
	const mmrCap = (await ControlPanel.getMMRCaps(`TEAM`))[team.tier];

	// console.log(roster.map(r => `${r.PrimaryRiotAccount.riotIGN} - ${r.PrimaryRiotAccount.MMR.mmrEffective}`))
	// console.log(rosterWithoutSubOut.map(r => `${r.PrimaryRiotAccount.riotIGN} - ${r.PrimaryRiotAccount.MMR.mmrEffective}`));

	// console.log(
	// 	Math.round(oldMMR),
	// 	Math.round(mmrWithoutSubOut),
	// 	Math.round(newMMR),
	// 	mmrCap
	// )

	// checks
	if (newMMR > mmrCap) return await interaction.editReply(`This player cannot be a substitute for ${team.name}, doing so would exceed the tier's MMR cap!\nAvailable MMR: ${oldMMR - mmrWithoutSubOut}\nSub MMR: ${subInData.PrimaryRiotAccount.MMR.mmrEffective}`);
	if (![LeagueStatus.FREE_AGENT, LeagueStatus.RESTRICTED_FREE_AGENT].includes(subInData.Status.leagueStatus)) return await interaction.editReply(`This player is not a Free Agent/Restricted Free Agent and cannot be signed to ${team.name}!`);
	if (subInData.Status.contractStatus === ContractStatus.ACTIVE_SUB) return await interaction.editReply(`This player is already an active sub and cannot sign another temporary contract!`);

	// create the base embed
	const embed = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `Are you sure you perform the following action?`,
		color: 0xe92929,
		fields: [
			{
				name: `\u200B`,
				value: `**Transaction**\n\`  Player Tag: \`\n\`   Player ID: \`\n\`         MMR: \`\n\`        Team: \`\n\`   Franchise: \`\n\`  Unsub Time: \``,
				inline: true,
			},
			{
				name: `\u200B`,
				value: `SUB\n${subIn}\n\`${subIn.id}\`\n\`${oldMMR} => ${newMMR} / ${mmrCap}\`\n${team.name}\n${franchise.name}\n<t:${unsubTime}:t> (<t:${unsubTime}:R>)`,
				inline: true,
			},
		],
		footer: { text: `Transactions — Sub` },
	});

	const cancel = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.CANCEL}`,
		label: `Cancel`,
		style: ButtonStyle.Danger,
	});

	const confirm = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.SUB_CONFIRM}`,
		label: `Confirm`,
		style: ButtonStyle.Success,
	});

	// create the action row, add the component to it & then editReply with all the data
	const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
	return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmSub(interaction) {
	const data = interaction.message.embeds[0].fields[1].value
		.replaceAll(`\``, ``)
		.split(`\n`);
	const playerID = data[2];

	const player = await Player.getBy({ discordID: playerID });
	const playerIGN = await Player.getIGNby({ discordID: playerID });
	const team = await Team.getBy({ name: data[4] });
	const franchise = await Franchise.getBy({ name: data[5] });

	const playerTag = playerIGN.split(`#`)[0];
	const guildMember = await interaction.guild.members.fetch(playerID);

	// cut the player & ensure that the player's team property is now null
	const updatedPlayer = await Transaction.sub({ userID: player.id, teamID: team.id, tier: team.tier });
	if (updatedPlayer.team !== team.id) return await interaction.editReply(`There was an error while attempting to sub the player. The database was not updated.`);

	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);
	embedEdits.setDescription(`This operation was successfully completed.`);
	embedEdits.setFields([]);
	await interaction.message.edit({ embeds: [embedEdits], components: [] });

	// create the base embed
	const announcement = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `${guildMember} (${playerTag}) has signed a temporary contract with ${franchise.name}!`,
		thumbnail: {
			url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchise.logoFileName}`,
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
			}
		],
		footer: { text: `Transactions — Sub` },
		timestamp: Date.now(),
	});

	await interaction.deleteReply();
	const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
	await transactionsChannel.send({ embeds: [announcement] });

	setTimeout(async () => {
		// unsub the player & ensure that the player's team property is now null
		const updatedPlayer = await Transaction.unsub(player.id);
		if (updatedPlayer.team !== null) return await interaction.channel.send(`There was an error while attempting to unsub ${guildMember} (${playerTag}). The database was not updated.`);

		// create the base embed
		const announcement = new EmbedBuilder({
			author: { name: `VDC Transactions Manager` },
			description: `${guildMember} (${playerTag})'s temporary contract with ${team.name} has ended!`,
			thumbnail: {
				url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchise.Brand.logo}`,
			},
			color: 0xe92929,
			footer: { text: `Transactions — Unsub` },
			timestamp: Date.now(),
		});

		return await transactionsChannel.send({ embeds: [announcement] });
	}, activeSubTime);
}
module.exports = {
	requestSub: requestSub,
	confirmSub: confirmSub,
};
