const { Guild } = require(`discord.js`);
const { ModLogType } = require(`@prisma/client`);
const { ModLogs, ControlPanel } = require(`../../../prisma`);
const { ROLES } = require(`../../../utils/enums`);
const { getRedisClient } = require(`../../core/redis`);
const { EXPIRY_KEY_PREFIX } = require(`../../helpers/mod/muteState`);
const { liftMute, liftBan, announceExpiredLift } = require(`../../helpers/mod/enforcement`);

/** Re-arm missing Redis expiry keys from active timed rows, so real-time
 * expiry self-heals after a Redis wipe/flush. SET NX never shortens or
 * overwrites a key that already exists. */
async function rearmExpiryKeys() {
	const redis = getRedisClient();
	const timedPunishments = [
		...(await ModLogs.activePunishments(ModLogType.MUTE)),
		...(await ModLogs.activePunishments(ModLogType.BAN)),
	].filter((row) => row.expires !== null);

	for (const row of timedPunishments) {
		const ttlSeconds = Math.ceil((row.expires.getTime() - Date.now()) / 1000);
		if (ttlSeconds <= 0) continue;
		await redis.set(`${EXPIRY_KEY_PREFIX}${row.type}:${row.discordID}`, `1`, `EX`, ttlSeconds, `NX`);
	}
}

/** One reconciliation pass: lift-only drift fixing from ModLogs truth.
 * Catches expiry events lost while the bot was down. Never re-applies.
 * @param {Guild} guild
 */
async function reconcileOnce(guild) {
	await rearmExpiryKeys();

	const activeMuteIDs = new Set((await ModLogs.activePunishments(ModLogType.MUTE)).map((row) => row.discordID));
	const everMutedIDs = await ModLogs.everSanctioned(ModLogType.MUTE);

	for (const discordID of everMutedIDs) {
		if (activeMuteIDs.has(discordID)) continue;
		const member = await guild.members.fetch(discordID).catch(() => null);
		if (member && member.roles.cache.has(ROLES.LEAGUE.MUTED)) {
			await liftMute(guild, discordID);
			await announceExpiredLift(guild, `UNMUTE`, discordID);
			logger.log(`INFO`, `Reconciliation lifted expired mute for ${discordID}`);
		}
	}

	// season bans: lift rows whose season has rolled past, then unban on
	// Discord only when no OTHER active ban remains for that player
	const currentSeason = Number(await ControlPanel.getSeason());
	if (Number.isFinite(currentSeason)) {
		const staleSeasonBans = await ModLogs.staleSeasonBans(currentSeason);
		for (const row of staleSeasonBans) {
			await ModLogs.liftPunishmentRow(row.id, `Season ban ended (covered through season ${row.season}).`);
			const remainingBans = await ModLogs.activePunishmentsFor(row.discordID, ModLogType.BAN);
			if (remainingBans.length === 0) {
				await liftBan(guild, row.discordID, `Season ban ended (through season ${row.season})`);
				await announceExpiredLift(guild, `UNBAN`, row.discordID);
			}
			logger.log(`INFO`, `Reconciliation lifted season ${row.season} ban for ${row.discordID}`);
		}
	}

	const activeBanIDs = new Set((await ModLogs.activePunishments(ModLogType.BAN)).map((row) => row.discordID));
	const everBannedIDs = new Set(await ModLogs.everSanctioned(ModLogType.BAN));
	const guildBans = await guild.bans.fetch();

	for (const [bannedUserID] of guildBans) {
		if (!everBannedIDs.has(bannedUserID)) continue; // manual ban, no rows - leave alone
		if (activeBanIDs.has(bannedUserID)) continue;
		await liftBan(guild, bannedUserID, `Ban expired (reconciliation)`);
		await announceExpiredLift(guild, `UNBAN`, bannedUserID);
		logger.log(`INFO`, `Reconciliation lifted expired ban for ${bannedUserID}`);
	}
}

module.exports = { reconcileOnce, rearmExpiryKeys };
