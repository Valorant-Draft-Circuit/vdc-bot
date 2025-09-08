const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ChatInputCommandInteraction, GuildMember } = require(`discord.js`);


const { Franchise, Player, Team, Transaction, ControlPanel } = require(`../../../../prisma`);
const { ROLES, CHANNELS, TransactionsNavigationOptions } = require(`../../../../utils/enums`);
const { Tier } = require("@prisma/client");
const { updateMeilisearchPlayer } = require("../../../../utils/web/vdcWeb");

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

/** Send confirmation to updateTier a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 * @param {String} newTier
 */
async function requestUpdateTier(interaction, player, newTier) {
	const playerData = await Player.getBy({ discordID: player.value });

	// checks
	if (playerData === null) return interaction.editReply(`This player doesn't exist!`);
	if (playerData.team === null) return interaction.editReply(`This player is not signed to a team and therefore cannot be promoted/demoted!`);


	const team = await Team.getBy({ id: playerData.team });
	const franchise = await Franchise.getBy({ teamID: playerData.team });

	// ensure that the player isn't being updaeted to the same team and that the franchise has an active team in the tier the player is being promotes/demoted to
	if (team.tier === newTier) return await interaction.editReply(`This player is already in the tier you're trying to promote/demote them to (${newTier})`);
	if (!franchise.Teams.filter((t) => t.active === true).map((t) => t.tier).includes(newTier)) return await interaction.editReply(`${franchise.name} does not have an active team in the ${newTier} tier!`);

	// create the base embed
	const embed = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `Are you sure you perform the following action?`,
		color: 0xe92929,
		fields: [
			{
				name: `\u200B`,
				value: `**Transaction**\n\`  Player Tag: \`\n\`   Player ID: \`\n\`    Old Tier: \`\n\`    New Tier: \``,
				inline: true,
			},
			{
				name: `\u200B`,
				value: `UPDATE TIER\n${player.user}\n\`${player.user.id}\`\n${team.tier}\n${newTier}`,
				inline: true,
			},
		],
		footer: { text: `Transactions — Tier Update (Promote/Demote)` },
	});

	const cancel = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.CANCEL}`,
		label: `Cancel`,
		style: ButtonStyle.Danger,
	});

	const confirm = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.UPDATE_TIER_COMFIRM}`,
		label: `Confirm`,
		style: ButtonStyle.Success,
	});


	// create the action row, add the component to it & then reply with all the data
	const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
	return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmUpdateTier(interaction) {

	const data = interaction.message.embeds[0].fields[1].value
		.replaceAll(`\``, ``)
		.split(`\n`);
	const playerID = data[2];

	const player = await Player.getBy({ discordID: playerID });
	const playerIGN = await Player.getIGNby({ discordID: playerID });
	const team = await Team.getBy({ id: player.team });
	const franchise = await Franchise.getBy({ teamID: team.id });
	const franchiseTeams = await Franchise.getTeams({ id: franchise.id });

	const newTeam = franchiseTeams.filter((t) => t.tier === data[4])[0];
	const playerTag = playerIGN.split(`#`)[0];
	const guildMember = await interaction.guild.members.fetch(playerID);

	// update the player the player & ensure that the player's team property is now null
	const updatedPlayer = await Transaction.updateTier({
		userID: player.id,
		teamID: newTeam.id,
	});
	if (updatedPlayer.team !== newTeam.id) return await interaction.editReply(`There was an error while attempting to update the player's tier. The database was not updated.`);

	await guildMember.roles.remove([
		...Object.values(ROLES.LEAGUE),
		...Object.values(ROLES.TIER),
	]);
	await guildMember.roles.add([
		ROLES.LEAGUE.LEAGUE,
		franchise.roleID
	]);

	const leagueState = await ControlPanel.getLeagueState();
	if (leagueState !== `COMBINES`) {
		await guildMember.roles.add(ROLES.TIER[newTeam.tier]);
		switch (newTeam.tier) {
			case Tier.RECRUIT:
				await guildMember.roles.add([ROLES.TIER.RECRUIT_FREE_AGENT]);
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
	}

	// create & send the "successfully completed" embed
	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);
	embedEdits.setDescription(`This operation was successfully completed.`);
	embedEdits.setFields([]);
	await interaction.message.edit({ embeds: [embedEdits], components: [] });

	// create the base embed
	const announcement = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `${guildMember} (${playerTag})'s tier was updated!\n${data[3]} => ${data[4]}`,
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
				value: newTeam.name,
				inline: true,
			},
		],
		footer: { text: `Transactions — Tier Update (Promote/Demote)` },
		timestamp: Date.now(),
	});
	
	// lastly, update meilisearch to contain their new information
	await updateMeilisearchPlayer(player.id)
	
	await interaction.deleteReply();
	const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
	return await transactionsChannel.send({ embeds: [announcement] });
}
module.exports = {
	requestUpdateTier: requestUpdateTier,
	confirmUpdateTier: confirmUpdateTier,
};
