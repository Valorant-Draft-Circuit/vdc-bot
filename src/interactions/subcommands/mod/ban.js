const { ChatInputCommandInteraction, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require(`discord.js`);
const { ModLogType } = require(`@prisma/client`);
const { ModLogs } = require(`../../../../prisma`);
const { ModNavigationOptions } = require(`../../../../utils/enums`);
const { buildConfirmationEmbed, buildLogEmbed, buildDmEmbed, getEmbedField } = require(`../../../helpers/mod/modLogEmbeds`);
const { resolveModUserID, validateTarget, validateBanEnforceable } = require(`../../../helpers/mod/guards`);
const { applyBan, postToModLog } = require(`../../../helpers/mod/enforcement`);
const { parseDuration } = require(`../../../helpers/mod/duration`);

async function request(/** @type ChatInputCommandInteraction */ interaction, targetUser, durationInput, rules, reason) {
	const targetError = validateTarget(interaction, targetUser);
	if (targetError) return interaction.editReply(targetError);

	const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
	const enforceError = validateBanEnforceable(interaction, targetMember);
	if (enforceError) return interaction.editReply(enforceError);

	let duration;
	try {
		duration = parseDuration(durationInput);
	} catch (error) {
		return interaction.editReply(error.message);
	}

	const embed = buildConfirmationEmbed({ action: ModLogType.BAN, targetUser, durationLabel: duration.label, rules, reason });
	const row = new ActionRowBuilder({
		components: [
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.CANCEL}`, label: `Cancel`, style: ButtonStyle.Danger }),
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.BAN_CONFIRM}`, label: `Confirm`, style: ButtonStyle.Success }),
		],
	});
	return interaction.editReply({ embeds: [embed], components: [row] });
}

async function confirm(/** @type ButtonInteraction */ interaction) {
	const embed = interaction.message.embeds[0];
	const targetID = getEmbedField(embed, `Target ID`).replaceAll(`\``, ``);
	const durationLabel = getEmbedField(embed, `Duration`);
	const rules = getEmbedField(embed, `Rules`);
	const reason = getEmbedField(embed, `Reason`);
	const { expires } = parseDuration(durationLabel);

	const modID = await resolveModUserID(interaction.user.id);
	if (!modID) return interaction.editReply(`You need a linked VDC account to log mod actions - link your Discord at https://vdc.gg/me first.`);

	const targetMember = await interaction.guild.members.fetch(targetID).catch(() => null);

	const enforceError = validateBanEnforceable(interaction, targetMember);
	if (enforceError) return interaction.editReply(enforceError);

	if (targetMember) {
		const dm = buildDmEmbed({ action: `BAN`, guildName: interaction.guild.name, durationLabel, rules, reason, expires });
		await targetMember.send({ embeds: [dm] }).catch(() => logger.log(`WARNING`, `Could not DM ban notice to ${targetID} (DMs closed)`));
	}

	// record before enforcement: a crash between the two must never leave an untracked live sanction
	await ModLogs.create({ discordID: targetID, modID, type: ModLogType.BAN, message: `${rules}\n${reason}`, expires });

	try {
		await applyBan(interaction.guild, targetID, `${rules}\n${reason}`, expires);
	} catch (error) {
		logger.log(`ERROR`, `Ban enforcement failed for ${targetID}`, error.stack);
		const failed = new EmbedBuilder(embed.toJSON());
		failed.setDescription(`The ModLogs record was written, but APPLYING the ban failed: \`${error.message}\`. Check the bot's role position/permissions, then re-run \`/mod ban\` or \`/mod unban\` to clear the record.`);
		await interaction.message.edit({ embeds: [failed], components: [] });
		return interaction.deleteReply();
	}

	await postToModLog(interaction.guild, buildLogEmbed({
		action: `BAN`, targetID, targetTag: targetMember?.user.tag, modTag: interaction.user.tag, durationLabel, rules, reason,
	}));

	const done = new EmbedBuilder(embed.toJSON());
	done.setDescription(`This action was completed.`);
	await interaction.message.edit({ embeds: [done], components: [] });
	return interaction.deleteReply();
}

module.exports = { request, confirm };
