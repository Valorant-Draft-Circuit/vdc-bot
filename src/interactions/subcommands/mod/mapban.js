const { ChatInputCommandInteraction, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require(`discord.js`);
const { ModLogType } = require(`@prisma/client`);
const { ModLogs, Player } = require(`../../../../prisma`);
const { ModNavigationOptions } = require(`../../../../utils/enums`);
const { buildConfirmationEmbed, buildLogEmbed, buildDmEmbed, getEmbedField } = require(`../../../helpers/mod/modLogEmbeds`);
const { resolveModUserID, validateTarget } = require(`../../../helpers/mod/guards`);
const { postToModLog } = require(`../../../helpers/mod/enforcement`);
const { isEligibleToPlay, getMapBanState, buildEligibilityLine } = require(`../../../helpers/mod/mapBans`);

async function request(/** @type ChatInputCommandInteraction */ interaction, targetUser, maps, rules, reason, appealable) {
	const targetError = validateTarget(interaction, targetUser);
	if (targetError) return interaction.editReply(targetError);

	const embed = buildConfirmationEmbed({
		action: ModLogType.MAP_BAN,
		targetUser,
		durationLabel: `${maps} map${maps === 1 ? `` : `s`}`,
		rules,
		reason,
		appealable,
	});
	const row = new ActionRowBuilder({
		components: [
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.CANCEL}`, label: `Cancel`, style: ButtonStyle.Danger }),
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.MAPBAN_CONFIRM}`, label: `Confirm`, style: ButtonStyle.Success }),
		],
	});
	return interaction.editReply({ embeds: [embed], components: [row] });
}

async function confirm(/** @type ButtonInteraction */ interaction) {
	const embed = interaction.message.embeds[0];
	const targetID = getEmbedField(embed, `Target ID`).replaceAll(`\``, ``);
	const rules = getEmbedField(embed, `Rules`);
	const reason = getEmbedField(embed, `Reason`);
	const appealable = getEmbedField(embed, `Appealable`) === `Yes`;
	const mapCount = Number(getEmbedField(embed, `Duration`).split(` `)[0]);

	const modID = await resolveModUserID(interaction.user.id);
	if (!modID) return interaction.editReply(`You need a linked VDC account to log mod actions - link your Discord at https://vdc.gg/me first.`);

	// an ineligible target (IR, retired, viewer) starts frozen: the ban only
	// begins ticking when they rejoin the FA/RFA/SIGNED group
	const targetPlayer = await Player.getBy({ discordID: targetID }).catch(() => null);
	const startsFrozen = targetPlayer != null && !isEligibleToPlay(targetPlayer);
	const details = startsFrozen
		? { mapCount, servedAtFreeze: 0, frozen: true }
		: { mapCount };

	await ModLogs.create({ discordID: targetID, modID, type: ModLogType.MAP_BAN, message: `${rules}\n${reason}`, details });

	// the DM projects against the aggregate of all active bans (stacked bans sum)
	const state = await getMapBanState(targetID, targetPlayer);
	const eligibilityLine = await buildEligibilityLine({ player: targetPlayer, remainingMaps: state.totalRemaining });

	const targetMember = await interaction.guild.members.fetch(targetID).catch(() => null);
	if (targetMember) {
		const dm = buildDmEmbed({
			action: ModLogType.MAP_BAN,
			guildName: interaction.guild.name,
			durationLabel: null,
			rules,
			reason,
			expires: null,
			appealable,
			mapCount,
			eligibilityLine,
		});
		await targetMember.send({ embeds: [dm] }).catch(() => logger.log(`WARNING`, `Could not DM map ban to ${targetID} (DMs closed)`));
	}

	await postToModLog(interaction.guild, buildLogEmbed({
		action: ModLogType.MAP_BAN,
		targetID,
		targetTag: targetMember?.user.tag,
		modTag: interaction.user.tag,
		durationLabel: `${mapCount} map${mapCount === 1 ? `` : `s`}`,
		rules,
		reason,
		appealable,
		extra: eligibilityLine,
	}));

	const done = new EmbedBuilder(embed.toJSON());
	done.setDescription(`This action was completed.`);
	await interaction.message.edit({ embeds: [done], components: [] });
	return interaction.deleteReply();
}

module.exports = { request, confirm };
