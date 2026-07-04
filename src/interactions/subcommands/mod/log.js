const { ChatInputCommandInteraction } = require(`discord.js`);
const { ModLogs } = require(`../../../../prisma`);
const { buildActionDetailEmbed } = require(`../../../helpers/mod/modLogEmbeds`);

async function log(/** @type ChatInputCommandInteraction */ interaction, id) {
	const row = await ModLogs.byId(id);
	if (!row) return interaction.editReply(`No mod action found with id \`#${id}\`.`);

	return interaction.editReply({ embeds: [buildActionDetailEmbed(row)] });
}

module.exports = { log };
