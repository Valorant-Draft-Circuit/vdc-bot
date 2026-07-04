const { ChatInputCommandInteraction, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require(`discord.js`);
const { ModLogType } = require(`@prisma/client`);
const { ModLogs } = require(`../../../../prisma`);
const { ModNavigationOptions } = require(`../../../../utils/enums`);
const { buildConfirmationEmbed, buildLogEmbed, getEmbedField } = require(`../../../helpers/mod/modLogEmbeds`);
const { resolveModUserID } = require(`../../../helpers/mod/guards`);
const { liftBan, postToModLog } = require(`../../../helpers/mod/enforcement`);

async function request(/** @type ChatInputCommandInteraction */ interaction, targetUser, reason) {
	const activeBans = await ModLogs.activeSanctionsFor(targetUser.id, ModLogType.BAN);
	if (activeBans.length === 0) return interaction.editReply(`${targetUser} has no active ban on record.`);

	const embed = buildConfirmationEmbed({ action: `UNBAN`, targetUser, durationLabel: null, reason });
	const row = new ActionRowBuilder({
		components: [
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.CANCEL}`, label: `Cancel`, style: ButtonStyle.Danger }),
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.UNBAN_CONFIRM}`, label: `Confirm`, style: ButtonStyle.Success }),
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

	const appealDate = new Date().toISOString().slice(0, 10);
	await ModLogs.liftSanctions({
		discordID: targetID,
		type: ModLogType.BAN,
		appealNote: `This has been APPEALED on ${appealDate}. ${reason}`,
	});
	const wasBanned = await liftBan(interaction.guild, targetID, reason);

	await postToModLog(interaction.guild, buildLogEmbed({
		action: `UNBAN`, targetID, modTag: interaction.user.tag, reason,
		extra: wasBanned ? null : `Note: the user was not on Discord's ban list (already unbanned?). ModLogs was still updated.`,
	}));

	const done = new EmbedBuilder(embed.toJSON());
	done.setDescription(`This action was completed.`);
	await interaction.message.edit({ embeds: [done], components: [] });
	return interaction.deleteReply();
}

module.exports = { request, confirm };
