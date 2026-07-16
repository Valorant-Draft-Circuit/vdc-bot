const { ChatInputCommandInteraction, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require(`discord.js`);
const { prisma } = require(`../../../../prisma/prismadb`);

const trackerMatchRegex = /^https:\/\/tracker.gg\/valorant\/match\/([a-z0-9]{8})-([a-z0-9]{4}-){3}([a-z0-9]{12})$/;
const EXPECTED_PLAYER_STATS = 10;

function resubmitCommand(tier, gameID) {
  const firstLetter = tier.charAt(0)
  const restInLowercase = tier.slice(1).toLowerCase()
  const tierNormalized = firstLetter + restInLowercase
  return `/submit tier:${tierNormalized} url:https://tracker.gg/valorant/match/${gameID}`;
}

async function debugGame(/** @type ChatInputCommandInteraction */ interaction) {
	const link = interaction.options.getString(`link`);
	if (!trackerMatchRegex.test(link)) return interaction.editReply(`That doesn't look like a valid tracker.gg match URL!`);

	const gameID = link.replace(`https://tracker.gg/valorant/match/`, ``);
	const game = await prisma.games.findUnique({ where: { gameID: gameID } });
	const statsCount = await prisma.playerStats.count({ where: { gameID: gameID } });

	if (game === null) {
		return interaction.editReply(`No Games row exists for [\`${gameID}\`](<${link}>) (PlayerStats rows: \`${statsCount}\`). Nothing to clean up. The match can be submitted with /submit.`);
	}

	if (statsCount === EXPECTED_PLAYER_STATS) {
		return interaction.editReply(`[\`${gameID}\`](<${link}>) exists with all \`${statsCount}\`/\`${EXPECTED_PLAYER_STATS}\` PlayerStats rows.`);
	}

	const embed = new EmbedBuilder({
		author: { name: `VDC Debug` },
		title: `Broken game submission`,
		description: [
			`**Game ID:** [\`${gameID}\`](<${link}>)`,
			`**Tier:** \`${game.tier}\` | **Type:** \`${game.gameType}\` | **Played:** <t:${Math.round(game.datePlayed.getTime() / 1000)}:f>`,
			`**PlayerStats rows:** \`${statsCount}\`/\`${EXPECTED_PLAYER_STATS}\``,
			``,
			`Deleting removes the Games row and its \`${statsCount}\` PlayerStats row${statsCount === 1 ? `` : `s`}, then resubmit with:`,
			`\`\`\`${resubmitCommand(game.tier, gameID)}\`\`\``,
		].join(`\n`),
		color: 0xe92929,
		footer: { text: `Debug - Game` },
	});

	const row = new ActionRowBuilder({
		components: [
			new ButtonBuilder({ customId: `debugGame_CANCEL`, label: `Cancel`, style: ButtonStyle.Secondary }),
			new ButtonBuilder({ customId: `debugGame_CONFIRM`, label: `Delete & allow resubmit`, style: ButtonStyle.Danger }),
		],
	});
	return interaction.editReply({ embeds: [embed], components: [row] });
}

async function confirmGameCleanup(/** @type ButtonInteraction */ interaction) {
	const embed = interaction.message.embeds[0];
	const gameID = embed.description.match(/\*\*Game ID:\*\* \[`([a-z0-9-]+)`\]/)?.[1];
	const tier = embed.description.match(/\*\*Tier:\*\* `([A-Z]+)`/)?.[1];
	if (!gameID) return interaction.editReply(`Could not recover the game id from the confirmation message.`);

	const deletedStats = await prisma.playerStats.deleteMany({ where: { gameID: gameID } });
	const deletedGames = await prisma.games.deleteMany({ where: { gameID: gameID } });

	const done = new EmbedBuilder(embed.toJSON());
	done.setDescription([
		`**Game ID:** \`${gameID}\``,
		`Deleted \`${deletedStats.count}\` PlayerStats row${deletedStats.count === 1 ? `` : `s`} and \`${deletedGames.count}\` Games row${deletedGames.count === 1 ? `` : `s`}.`,
		`Reprocess the match with:`,
		`\`\`\`${resubmitCommand(tier ?? `<tier>`, gameID)}\`\`\``,
	].join(`\n`));
	await interaction.message.edit({ embeds: [done], components: [] });
	return interaction.deleteReply();
}

async function cancelGameCleanup(/** @type ButtonInteraction */ interaction) {
	const embed = interaction.message.embeds[0];
	const cancelled = new EmbedBuilder(embed.toJSON());
	cancelled.setDescription(`This action was cancelled. Nothing has been deleted.`);
	await interaction.message.edit({ embeds: [cancelled], components: [] });
	return interaction.deleteReply();
}

module.exports = { debugGame, confirmGameCleanup, cancelGameCleanup };
