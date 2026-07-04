const { ChatInputCommandInteraction, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ModLogs } = require(`../../../../prisma`);
const { ModNavigationOptions } = require(`../../../../utils/enums`);
const { buildHistoryEmbed, parseHistoryEmbedState, HISTORY_PAGE_SIZE } = require(`../../../helpers/mod/modLogEmbeds`);

function buildPaginationRow(page, totalPages) {
	return new ActionRowBuilder({
		components: [
			new ButtonBuilder({
				customId: `mod_${ModNavigationOptions.HISTORY_PREV}`,
				label: `Back`,
				style: ButtonStyle.Secondary,
				disabled: page <= 0,
			}),
			new ButtonBuilder({
				customId: `mod_${ModNavigationOptions.HISTORY_NEXT}`,
				label: `Next`,
				style: ButtonStyle.Secondary,
				disabled: page >= totalPages - 1,
			}),
		],
	});
}

function buildHistoryPage(targetUser, rows, page) {
	const totalPages = Math.max(1, Math.ceil(rows.length / HISTORY_PAGE_SIZE));
	const embed = buildHistoryEmbed({ targetUser, rows, page });
	const components = totalPages > 1 ? [buildPaginationRow(page, totalPages)] : [];
	return { embeds: [embed], components };
}

async function history(/** @type ChatInputCommandInteraction */ interaction, targetUser) {
	const rows = await ModLogs.historyFor(targetUser.id);
	return interaction.editReply(buildHistoryPage(targetUser, rows, 0));
}

/** Button handler: turn the page in the direction the pressed button encodes.
 * State (player + current page) is recovered from the message's embed. */
async function page(/** @type ButtonInteraction */ interaction, direction) {
	const { targetID, page: currentPage } = parseHistoryEmbedState(interaction.message.embeds[0]);
	if (!targetID) return interaction.editReply(`Could not read the player from this history message.`);

	const rows = await ModLogs.historyFor(targetID);
	const totalPages = Math.max(1, Math.ceil(rows.length / HISTORY_PAGE_SIZE));
	const newPage = Math.min(Math.max(currentPage + direction, 0), totalPages - 1);

	const targetUser = { toString: () => `<@${targetID}>`, id: targetID };
	await interaction.message.edit(buildHistoryPage(targetUser, rows, newPage));
	return interaction.deleteReply();
}

module.exports = { history, page };
