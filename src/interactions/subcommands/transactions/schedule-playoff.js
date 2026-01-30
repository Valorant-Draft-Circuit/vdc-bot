const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ChatInputCommandInteraction } = require(`discord.js`);

const { Team, ControlPanel } = require(`../../../../prisma`);
const { CHANNELS, TransactionsNavigationOptions } = require(`../../../../utils/enums`);
const { prisma } = require("../../../../prisma/prismadb");
const { Tier, MatchType } = require("@prisma/client");

const timestampValidator = /(?<=<t:)\d+(?=:\S>)/;

/** Schedule a new playoff match
 * @param {ChatInputCommandInteraction} interaction
 */
async function schedulePlayoff(interaction, homeTeamName, awayTeamName, tier, matchType, matchday, dateString) {
	const validatedTime = dateString.match(timestampValidator);
	if (validatedTime == null) return await interaction.editReply(`This is an invalid time!`);

	const time = validatedTime[0];
	const dateTime = new Date(time * 1000).toUTCString();

	// Get teams
	const homeTeam = await Team.getBy({ name: homeTeamName });
	const awayTeam = await Team.getBy({ name: awayTeamName });

	if (homeTeam == null) return await interaction.editReply(`Home team "${homeTeamName}" not found!`);
	if (awayTeam == null) return await interaction.editReply(`Away team "${awayTeamName}" not found!`);
	if (homeTeam.id === awayTeam.id) return await interaction.editReply(`Home and Away teams cannot be the same!`);

	// Validate tier
	const tierUpper = tier.toUpperCase();
	if (!Object.values(Tier).includes(tierUpper)) {
		return await interaction.editReply(`Invalid tier! Must be one of: ${Object.values(Tier).join(", ")}`);
	}

	// Validate match type
	const matchTypeUpper = matchType.toUpperCase();
	if (!Object.values(MatchType).includes(matchTypeUpper)) {
		return await interaction.editReply(`Invalid match type! Must be one of: ${Object.values(MatchType).join(", ")}`);
	}

	// Get season
	const season = await ControlPanel.getSeason();

	// create the base embed
	const embed = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `Are you sure you want to perform the following action?`,
		color: 0xe92929,
		fields: [
			{
				name: `\u200B`,
				value: `**Transaction**\n\`       Tier: \`\n\` Match Type: \`\n\`       Home: \`\n\`       Away: \`\n\`  Match Day: \`\n\`       Date: \`\n\`     Season: \``,
				inline: true,
			},
			{
				name: `\u200B`,
				value: `SCHEDULE PLAYOFF\n${tierUpper}\n${matchTypeUpper}\n${homeTeam.name}\n${awayTeam.name}\n${matchday}\n<t:${time}:f> (<t:${time}:R>)\n${season}`,
				inline: true,
			},
			{
				name: `\u200B`,
				value: `${homeTeam.id}|${awayTeam.id}|${new Date(time * 1000).toISOString()}|${matchday}`,
				inline: false,
			},
		],
		footer: { text: `Transactions — Schedule Playoff` },
	});

	const cancel = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.CANCEL}`,
		label: `Cancel`,
		style: ButtonStyle.Danger,
	});

	const confirm = new ButtonBuilder({
		customId: `transactions_${TransactionsNavigationOptions.SCHEDULE_PLAYOFF_CONFIRM}`,
		label: `Confirm`,
		style: ButtonStyle.Success,
	});

	// create the action row, add the component to it & then reply with all the data
	const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
	return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

/** Confirm and execute the playoff schedule creation
 * @param {ChatInputCommandInteraction} interaction
 */
async function confirmSchedulePlayoff(interaction) {
	const embedData = interaction.message.embeds[0];
	const fields = embedData.fields;
	
	// Extract data from embed fields
	const params = fields[1].value.replaceAll(`\``, ``).split(`\n`);
	const dataField = fields[2].value;
	const [homeTeamId, awayTeamId, dateTimeStr, matchday] = dataField.split(`|`);

	const tier = params[1];
	const matchType = params[2];
	const dateTime = new Date(dateTimeStr);
	const timestamp = Math.floor(dateTime.getTime() / 1000);
	const season = Number(params[7]);

	try {
		// Create the match
		const newMatch = await prisma.matches.create({
			data: {
				tier: tier,
				matchType: matchType,
				home: Number(homeTeamId),
				away: Number(awayTeamId),
				matchDay: Number(matchday),
				dateScheduled: dateTime,
				season: season,
			},
			include: { 
				Home: { 
					include: { 
						Franchise: { 
							include: { Brand: true } 
						} 
					} 
				}, 
				Away: { 
					include: { 
						Franchise: { 
							include: { Brand: true } 
						} 
					} 
				} 
			}
		});

		const embedEdits = new EmbedBuilder(embedData);
		embedEdits.setDescription(`This operation was successfully completed.`);
		embedEdits.setFields([]);
		await interaction.message.edit({ embeds: [embedEdits], components: [] });

		// Create announcement embed
		const announcement = new EmbedBuilder({
			author: { name: `VDC Transactions Manager` },
			description: `The playoff match between <${newMatch.Home.Franchise.Brand.discordEmote}> ${newMatch.Home.name} & <${newMatch.Away.Franchise.Brand.discordEmote}> ${newMatch.Away.name} has been scheduled for <t:${timestamp}:F>`,
			color: 0xe92929,
			footer: { text: `Transactions — Playoff Schedule` },
			timestamp: Date.now(),
		});

		await interaction.deleteReply();
		const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
		return await transactionsChannel.send({ embeds: [announcement] });
	} catch (error) {
		console.error(error);
		return await interaction.editReply({
			content: `An error occurred while scheduling the playoff match: ${error.message}`,
			embeds: [],
			components: []
		});
	}
}

module.exports = {
    schedulePlayoff: schedulePlayoff,
    confirmSchedulePlayoff: confirmSchedulePlayoff,
};