const { ChatInputCommandInteraction, GuildMember, ButtonBuilder, ButtonStyle } = require("discord.js");

const { EmbedBuilder, ActionRowBuilder } = require("discord.js");
const { Player, Franchise, Transaction, Team } = require("../../../../prisma");
const { ContractStatus } = require("@prisma/client");
const { CHANNELS, TransactionsNavigationOptions } = require("../../../../utils/enums");
const { updateMeilisearchPlayer } = require("../../../../utils/web/vdcWeb");

/** Send confirmation to Unsub a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 */

async function requestUnsub(
	/** @type ChatInputCommandInteraction */ interaction,
	/** @type GuildMember */ sub,
) {
	const player = await Player.getBy({ discordID: sub.id });

	// checks
	if (player == undefined) return await interaction.editReply(`This player doesn't exist!`);
	if (player.Status.contractStatus !== ContractStatus.ACTIVE_SUB) return await interaction.editReply(`This player is not an active sub!`);

	const team = await Team.getBy({ id: player.team });
	// const roster = await Team.getRosterBy({ id: player.team });
	const franchise = await Franchise.getBy({ id: team.franchise });

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
				value: `UNSUB\n${sub.user}\n\`${sub.id}\`\n${team.name}\n${franchise.name}`,
				inline: true,
			},
		],
		footer: { text: `Transactions — Unsub` },
	});

	const cancel = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.CANCEL}`,
		label: `Cancel`,
		style: ButtonStyle.Danger,
	});

	const confirm = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.UNSUB_CONFIRM}`,
		label: `Confirm`,
		style: ButtonStyle.Success,
	});

	// create the action row, add the component to it & then editReply with all the data
	const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
	return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmUnsub(interaction) {

	const data = interaction.message.embeds[0].fields[1].value
		.replaceAll(`\``, ``)
		.split(`\n`);
	const playerID = data[2];

	const playerData = await Player.getBy({ discordID: playerID });
	const playerIGN = await Player.getIGNby({ discordID: playerID });
	const team = await Team.getBy({ name: data[3] });
	const franchise = await Franchise.getBy({ name: data[4] });

	const playerTag = playerIGN.split(`#`)[0];
	const guildMember = await interaction.guild.members.fetch(playerID);

	// cut the player & ensure that the player's team property is now null
	const player = await Transaction.unsub(playerData.id);
	if (player.team !== null) return await interaction.editReply(`There was an error while attempting to unsub the player. The database was not updated.`);

	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);
	embedEdits.setDescription(`This operation was successfully completed.`);
	embedEdits.setFields([]);
	await interaction.message.edit({ embeds: [embedEdits], components: [] });

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

	await interaction.deleteReply();
	const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
	return await transactionsChannel.send({ embeds: [announcement] });
}

module.exports = {
	requestUnsub: requestUnsub,
	confirmUnsub: confirmUnsub,
};
