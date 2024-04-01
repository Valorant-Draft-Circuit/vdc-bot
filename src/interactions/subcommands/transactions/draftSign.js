const { ChatInputCommandInteraction, GuildMember } = require("discord.js");

const {
	EmbedBuilder,
	ActionRowBuilder,
	StringSelectMenuBuilder,
	UserSelectMenuBuilder,
} = require("discord.js");

/** Send confirmation to DraftSign a player
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} player
 * @param {Number} round
 * @param {Number} pick
 * @param {String} teamName
 */

async function requestDraftSign(interaction, round, pick, player, teamName) {
	await interaction.deferReply();

	const playerData = await Player.getBy({ discordID: player.id });
	const teamData = await Team.getBy({ name: teamName });
	const franchiseData = await Franchise.getBy({ id: teamData.franchise });

	// checks
	if (playerData == undefined)
		return interaction.editReply({
			content: `This player doesn't exist!`,
			ephemeral: false,
		});
	// if (playerData.status !== PlayerStatusCode.DRAFT_ELIGIBLE) return interaction.editReply({ content: `This player is not Draft Eligible and cannot be pulled from the draft!`, ephemeral: false });

	// create the base embed
	const embed = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `Are you sure you perform the following action?`,
		color: 0xe92929,
		fields: [
			{
				name: `\u200B`,
				value: `**Transaction**\n\`  Round/Pick : \`\n\`   Player Tag: \`\n\`    Player ID: \`\n\`         Team: \`\n\`    Franchise: \``,
				inline: true,
			},
			{
				name: `\u200B`,
				value: `DRAFT SIGN\n\` ${round} / ${pick} \`\n${player.user}\n\`${player.id}\`\n${teamData.name}\n${franchiseData.name}`,
				inline: true,
			},
		],
		footer: { text: `Transactions — Draft Sign` },
	});

	const cancel = new ButtonBuilder({
		customId: `transactions_${TransactionsDraftSignOptions.CANCEL}`,
		label: `Cancel`,
		style: ButtonStyle.Danger,
	});

	const confirm = new ButtonBuilder({
		customId: `transactions_${TransactionsDraftSignOptions.CONFIRM}`,
		label: `Confirm`,
		style: ButtonStyle.Success,
	});

	// create the action row, add the component to it & then editReply with all the data
	const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
	return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmDraftSign(interaction) {
	await interaction.deferReply({ ephemeral: true }); // defer as early as possible

	const data = interaction.message.embeds[0].fields[1].value
		.replaceAll(`\``, ``)
		.split(`\n`);

	// process data into usable format(s)
	const playerID = data[3];
	const round = data[1].split(`/`)[0].trim();
	const pick = data[1].split(`/`)[1].trim();

	// db queries
	const playerData = await Player.getBy({ discordID: playerID });
	const playerIGN = await Player.getIGNby({ discordID: playerID });
	const teamData = await Team.getBy({ name: data[4] });
	const franchiseData = await Franchise.getBy({ name: data[5] });

	// also get the GuildMember object
	const playerTag = playerIGN.split(`#`)[0];
	const guildMember = await interaction.guild.members.fetch(playerID);
	const accolades = guildMember.nickname?.match(emoteregex);

	// add the franchise role, remove FA/RFA role
	if (!guildMember._roles.includes(franchiseData.roleID))
		await guildMember.roles.add(franchiseData.roleID);
	if (guildMember._roles.includes(ROLES.LEAGUE.DRAFT_ELIGIBLE))
		await guildMember.roles.remove(ROLES.LEAGUE.DRAFT_ELIGIBLE);
	if (guildMember._roles.includes(ROLES.LEAGUE.FREE_AGENT))
		await guildMember.roles.remove(ROLES.LEAGUE.FREE_AGENT);
	if (guildMember._roles.includes(ROLES.LEAGUE.RESTRICTED_FREE_AGENT))
		await guildMember.roles.remove(ROLES.LEAGUE.RESTRICTED_FREE_AGENT);

	switch (teamData.tier) {
		case `Prospect`:
			await guildMember.roles.add(ROLES.TIER.PROSPECT);
			console.log(`here`);
			break;
		case `Apprentice`:
			await guildMember.roles.add(ROLES.TIER.APPRENTICE);
			break;
		case `Expert`:
			await guildMember.roles.add(ROLES.TIER.EXPERT);
			break;
		case `Mythic`:
			await guildMember.roles.add(ROLES.TIER.MYTHIC);
			break;
	}

	// update nickname
	guildMember.setNickname(
		`${franchiseData.slug} | ${playerTag} ${accolades ? accolades.join(``) : ``
		}`
	);

	// sign the player & ensure that the player's team property is now null
	const player = await Transaction.sign({
		playerID: playerData.id,
		teamID: teamData.id,
	});
	if (player.team !== teamData.id)
		return await interaction.editReply({
			content: `There was an error while attempting to sign the player's contract. The database was not updated.`,
		});

	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);
	embedEdits.setDescription(`This operation was successfully completed.`);
	embedEdits.setFields([]);
	await interaction.message.edit({ embeds: [embedEdits], components: [] });

	// create the base embed
	const announcement = new EmbedBuilder({
		author: { name: `Round: ${round} | Pick: ${pick} | ${teamData.tier}` },
		description: `${teamData.name} select ${guildMember} (${playerTag})!`,
		thumbnail: {
			url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchiseData.logoFileName}`,
		},
		color: 0xe92929,
		fields: [
			{
				name: `Franchise`,
				value: `<${franchiseData.emoteID}> ${franchiseData.name}`,
				inline: true,
			},
			{
				name: `Team`,
				value: teamData.name,
				inline: true,
			},
			/** @TODO Once GM discord IDs are in Franchsie Table, show this block */
			// {
			//     name: `General Manager`,
			//     value: `"\${franchiseData.gm}"`,
			//     inline: true
			// }
		],
		footer: { text: `Transactions — Draft Sign` },
		timestamp: Date.now(),
	});

	await interaction.deleteReply();
	return await transactionsAnnouncementChannel.send({ embeds: [announcement] });
}
module.exports = {
	requestDraftSign: requestDraftSign,
	confirmDraftSign: confirmDraftSign,
};
