const { ChatInputCommandInteraction } = require(`discord.js`);
const { ModLogs } = require(`../../../../prisma`);
const { buildHistoryEmbed } = require(`../../../helpers/mod/modLogEmbeds`);

async function history(/** @type ChatInputCommandInteraction */ interaction, targetUser) {
	const rows = await ModLogs.historyFor(targetUser.id);
	return interaction.editReply({ embeds: [buildHistoryEmbed({ targetUser, rows })] });
}

module.exports = { history };
