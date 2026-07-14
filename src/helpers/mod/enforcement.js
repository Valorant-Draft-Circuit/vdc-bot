const { Guild, GuildMember, EmbedBuilder } = require(`discord.js`);
const { ROLES, CHANNELS } = require(`../../../utils/enums`);
const { saveMuteState, getMuteState, clearMuteState, rewriteMuteCache, setExpiryKey, clearExpiryKey } = require(`./muteState`);
const { rebuildMemberProfile } = require(`../profileRebuild`);
const { buildLogEmbed } = require(`./modLogEmbeds`);

/** Strip all roles (snapshot them), apply the Muted role, set the expiry key.
 * @param {GuildMember} member
 * @param {Date|null} expires
 */
async function applyMute(member, expires) {
	const strippableRoleIds = member.roles.cache
		.filter((role) => !role.managed && role.id !== member.guild.id && role.id !== ROLES.LEAGUE.MUTED)
		.map((role) => role.id);

	// re-muting (e.g. extending a duration): the member's real roles were
	// already stripped, so keep the original snapshot instead of clobbering
	// it with the post-strip (Muted-only) state
	const existingSnapshot = await getMuteState(member.id);
	if (existingSnapshot === null) {
		await saveMuteState(member.id, strippableRoleIds);
	} else {
		await rewriteMuteCache();
	}

	if (strippableRoleIds.length > 0) await member.roles.remove(strippableRoleIds);
	await member.roles.add(ROLES.LEAGUE.MUTED);

	// clear any previous timed key first: re-muting with "perm" must not
	// leave a stale TTL that would auto-lift the now-permanent mute
	await clearExpiryKey(`MUTE`, member.id);
	await setExpiryKey(`MUTE`, member.id, expires);
}

/** Remove the Muted role, restore the snapshot, rebuild league roles from DB.
 * Safe when the member is no longer in the guild (state still cleaned up).
 * @param {Guild} guild
 * @param {string} discordID
 */
async function liftMute(guild, discordID) {
	await clearExpiryKey(`MUTE`, discordID);
	const muteState = await getMuteState(discordID);

	const member = await guild.members.fetch(discordID).catch(() => null);
	const hadMutedRole = member?.roles.cache.has(ROLES.LEAGUE.MUTED) ?? false;
	if (member) {
		await member.roles.remove(ROLES.LEAGUE.MUTED).catch(() => undefined);
		if (Array.isArray(muteState) && muteState.length > 0) {
			await member.roles.add(muteState).catch(() => undefined);
		}
		await rebuildMemberProfile(member).catch(() => undefined);
	}

	await clearMuteState(discordID);

	// `lifted` lets automatic callers (subscriber + reconciler, which are
	// DESIGNED to overlap) announce exactly once: the second racer finds no
	// role and no snapshot and stays quiet
	return { memberWasPresent: member !== null, lifted: hadMutedRole || muteState !== null };
}

/** Ban by ID (works for users not in the guild), set the expiry key.
 * Discord caps audit-log reasons at 512 chars; the full text lives in ModLogs. */
async function applyBan(guild, discordID, reason, expires) {
	await guild.members.ban(discordID, { reason: reason.slice(0, 512) });

	// clear any previous timed key first: re-banning with "perm" must not
	// leave a stale TTL that would auto-lift the now-permanent ban
	await clearExpiryKey(`BAN`, discordID);
	await setExpiryKey(`BAN`, discordID, expires);
}

/** Unban by ID; tolerates "not banned". Returns whether an unban happened. */
async function liftBan(guild, discordID, reason) {
	await clearExpiryKey(`BAN`, discordID);
	try {
		await guild.bans.remove(discordID, reason);
		return true;
	} catch {
		return false;
	}
}

/** Post an embed to the mod-log channel (best-effort). */
async function postToModLog(guild, embed) {
	const channel = await guild.channels.fetch(CHANNELS.MOD_LOG).catch(() => null);
	if (channel) await channel.send({ embeds: [embed] }).catch(() => undefined);
}

/** Announce an automatic (expiry-driven) lift. */
async function announceExpiredLift(guild, action, discordID) {
	const embed = buildLogEmbed({
		action, targetID: discordID, modTag: `automatic`,
		reason: `Punishment expired.`,
	});
	await postToModLog(guild, embed);
}

module.exports = { applyMute, liftMute, applyBan, liftBan, postToModLog, announceExpiredLift };
