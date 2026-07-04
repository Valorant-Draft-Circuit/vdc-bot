const { ChatInputCommandInteraction, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require(`discord.js`);
const { ModLogType } = require(`@prisma/client`);
const { ModLogs } = require(`../../../../prisma`);
const { ModNavigationOptions } = require(`../../../../utils/enums`);
const { buildConfirmationEmbed, buildLogEmbed, buildDmEmbed, getEmbedField } = require(`../../../helpers/mod/modLogEmbeds`);
const { resolveModUserID, validateTarget } = require(`../../../helpers/mod/guards`);
const { postToModLog } = require(`../../../helpers/mod/enforcement`);

async function request(/** @type ChatInputCommandInteraction */ interaction, targetUser, isFormal, rules, reason) {
	const targetError = validateTarget(interaction, targetUser);
	if (targetError) return interaction.editReply(targetError);

	// policy: formal warnings are appealable, informal ones are not
	const action = isFormal ? ModLogType.FORMAL_WARNING : ModLogType.INFORMAL_WARNING;
	const embed = buildConfirmationEmbed({ action, targetUser, durationLabel: null, rules, reason, appealable: isFormal });
	const row = new ActionRowBuilder({
		components: [
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.CANCEL}`, label: `Cancel`, style: ButtonStyle.Danger }),
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.WARN_CONFIRM}`, label: `Confirm`, style: ButtonStyle.Success }),
		],
	});
	return interaction.editReply({ embeds: [embed], components: [row] });
}

async function confirm(/** @type ButtonInteraction */ interaction) {
	const embed = interaction.message.embeds[0];
	const action = getEmbedField(embed, `Action`);
	const appealable = action === ModLogType.FORMAL_WARNING;
	const targetID = getEmbedField(embed, `Target ID`).replaceAll(`\``, ``);
	const rules = getEmbedField(embed, `Rules`);
	const reason = getEmbedField(embed, `Reason`);

	const modID = await resolveModUserID(interaction.user.id);
	if (!modID) return interaction.editReply(`You need a linked VDC account to log mod actions - link your Discord at https://vdc.gg/me first.`);

	await ModLogs.create({ discordID: targetID, modID, type: action, message: `${rules}\n${reason}` });

	const targetMember = await interaction.guild.members.fetch(targetID).catch(() => null);
	if (targetMember) {
		const dm = buildDmEmbed({ action, guildName: interaction.guild.name, durationLabel: null, rules, reason, expires: null, appealable });
		await targetMember.send({ embeds: [dm] }).catch(() => logger.log(`WARNING`, `Could not DM warning to ${targetID} (DMs closed)`));
	}

	await postToModLog(interaction.guild, buildLogEmbed({
		action, targetID, targetTag: targetMember?.user.tag, modTag: interaction.user.tag, rules, reason, appealable,
	}));

	const done = new EmbedBuilder(embed.toJSON());
	done.setDescription(`This action was completed.`);
	await interaction.message.edit({ embeds: [done], components: [] });
	return interaction.deleteReply();
}

module.exports = { request, confirm };
