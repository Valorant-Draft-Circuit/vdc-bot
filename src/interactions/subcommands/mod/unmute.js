const { ChatInputCommandInteraction, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require(`discord.js`);
const { ModLogType } = require(`@prisma/client`);
const { ModLogs } = require(`../../../../prisma`);
const { ModNavigationOptions } = require(`../../../../utils/enums`);
const { buildConfirmationEmbed, buildLogEmbed, getEmbedField } = require(`../../../helpers/mod/modLogEmbeds`);
const { resolveModUserID } = require(`../../../helpers/mod/guards`);
const { liftMute, postToModLog } = require(`../../../helpers/mod/enforcement`);
const { getMuteState } = require(`../../../helpers/mod/muteState`);
const { ROLES } = require(`../../../../utils/enums`);

async function request(/** @type ChatInputCommandInteraction */ interaction, targetUser, reason) {
	// unmute is allowed when ANY mute residue exists - an active row, the Muted
	// role itself, or a leftover snapshot - so a lift that was missed (e.g. a
	// restart ate the expiry event) can always be healed manually
	const activeMutes = await ModLogs.activePunishmentsFor(targetUser.id, ModLogType.MUTE);
	const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
	const hasMutedRole = targetMember?.roles.cache.has(ROLES.LEAGUE.MUTED) ?? false;
	const staleSnapshot = await getMuteState(targetUser.id);

	if (activeMutes.length === 0 && !hasMutedRole && staleSnapshot === null) {
		return interaction.editReply(`${targetUser} has no active mute, no Muted role, and no mute state on record - nothing to lift.`);
	}

	const embed = buildConfirmationEmbed({ action: `UNMUTE`, targetUser, durationLabel: null, reason });
	const row = new ActionRowBuilder({
		components: [
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.CANCEL}`, label: `Cancel`, style: ButtonStyle.Danger }),
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.UNMUTE_CONFIRM}`, label: `Confirm`, style: ButtonStyle.Success }),
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
	await ModLogs.liftPunishments({
		discordID: targetID,
		type: ModLogType.MUTE,
		appealNote: `This has been APPEALED on ${appealDate}. ${reason}`,
	});
	const { memberWasPresent } = await liftMute(interaction.guild, targetID);

	await postToModLog(interaction.guild, buildLogEmbed({
		action: `UNMUTE`, targetID, modTag: interaction.user.tag, reason,
		extra: memberWasPresent ? null : `Note: the user is not currently in the server; mute state was cleaned up.`,
	}));

	const done = new EmbedBuilder(embed.toJSON());
	done.setDescription(`This action was completed.`);
	await interaction.message.edit({ embeds: [done], components: [] });
	return interaction.deleteReply();
}

module.exports = { request, confirm };
