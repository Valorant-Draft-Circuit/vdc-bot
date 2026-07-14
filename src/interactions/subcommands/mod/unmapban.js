const { ChatInputCommandInteraction, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require(`discord.js`);
const { Player } = require(`../../../../prisma`);
const { ModNavigationOptions } = require(`../../../../utils/enums`);
const { buildConfirmationEmbed, buildLogEmbed, getEmbedField } = require(`../../../helpers/mod/modLogEmbeds`);
const { resolveModUserID } = require(`../../../helpers/mod/guards`);
const { postToModLog } = require(`../../../helpers/mod/enforcement`);
const { getMapBanState, liftMapBans } = require(`../../../helpers/mod/mapBans`);

async function request(/** @type ChatInputCommandInteraction */ interaction, targetUser, reason) {
	const targetPlayer = await Player.getBy({ discordID: targetUser.id }).catch(() => null);
	const state = await getMapBanState(targetUser.id, targetPlayer);
	if (state.totalRemaining === 0) {
		return interaction.editReply(`${targetUser} has no active map ban - nothing to lift.`);
	}

	const embed = buildConfirmationEmbed({
		action: `UNMAPBAN`,
		targetUser,
		durationLabel: `${state.totalRemaining} map${state.totalRemaining === 1 ? `` : `s`} remaining`,
		reason,
	});
	const row = new ActionRowBuilder({
		components: [
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.CANCEL}`, label: `Cancel`, style: ButtonStyle.Danger }),
			new ButtonBuilder({ customId: `mod_${ModNavigationOptions.UNMAPBAN_CONFIRM}`, label: `Confirm`, style: ButtonStyle.Success }),
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

	const liftDate = new Date().toISOString().slice(0, 10);
	const liftedMaps = await liftMapBans(targetID, `This has been LIFTED on ${liftDate}. ${reason}`);

	await postToModLog(interaction.guild, buildLogEmbed({
		action: `UNMAPBAN`,
		targetID,
		modTag: interaction.user.tag,
		durationLabel: `${liftedMaps} map${liftedMaps === 1 ? `` : `s`} lifted`,
		reason,
	}));

	const done = new EmbedBuilder(embed.toJSON());
	done.setDescription(`This action was completed.`);
	await interaction.message.edit({ embeds: [done], components: [] });
	return interaction.deleteReply();
}

module.exports = { request, confirm };
