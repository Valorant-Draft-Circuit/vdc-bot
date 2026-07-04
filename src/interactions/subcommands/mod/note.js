const { ChatInputCommandInteraction, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require(`discord.js`);
const { ModLogType } = require(`@prisma/client`);
const { ModLogs } = require(`../../../../prisma`);
const { ModNavigationOptions } = require(`../../../../utils/enums`);
const { buildConfirmationEmbed, buildLogEmbed, getEmbedField } = require(`../../../helpers/mod/modLogEmbeds`);
const { resolveModUserID, validateTarget } = require(`../../../helpers/mod/guards`);
const { postToModLog } = require(`../../../helpers/mod/enforcement`);

const RESERVED_NOTE_PREFIX = `Deleted Pick'ems group`;

async function request(/** @type ChatInputCommandInteraction */ interaction, targetUser, reason) {
	const targetError = validateTarget(interaction, targetUser);
	if (targetError) return interaction.editReply(targetError);
	if (reason.startsWith(RESERVED_NOTE_PREFIX)) {
		return interaction.editReply(`Notes starting with \`${RESERVED_NOTE_PREFIX}\` are reserved by the web dashboard. Please reword.`);
	}

	const embed = buildConfirmationEmbed({ action: ModLogType.NOTE, targetUser, durationLabel: null, reason });
	const row = new ActionRowBuilder({
		components: [
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.CANCEL}`, label: `Cancel`, style: ButtonStyle.Danger }),
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.NOTE_CONFIRM}`, label: `Confirm`, style: ButtonStyle.Success }),
		],
	});
	return interaction.editReply({ embeds: [embed], components: [row] });
}

async function confirm(/** @type ButtonInteraction */ interaction) {
	const embed = interaction.message.embeds[0];
	const targetID = getEmbedField(embed, `Target ID`).replaceAll(`\``, ``);
	const reason = getEmbedField(embed, `Reason`);

	const modID = await resolveModUserID(interaction.user.id);
	if (!modID) return interaction.editReply(`You need a linked VDC account to log mod actions - link your Discord at https://vdc.gg/me first.`);

	await ModLogs.create({ discordID: targetID, modID, type: ModLogType.NOTE, message: reason });

	await postToModLog(interaction.guild, buildLogEmbed({
		action: `NOTE`, targetID, modTag: interaction.user.tag, reason,
	}));

	const done = new EmbedBuilder(embed.toJSON());
	done.setDescription(`This action was completed.`);
	await interaction.message.edit({ embeds: [done], components: [] });
	return interaction.deleteReply();
}

module.exports = { request, confirm };
