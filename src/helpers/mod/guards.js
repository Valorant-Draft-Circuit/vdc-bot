const { GuildMember, ChatInputCommandInteraction, PermissionFlagsBits } = require(`discord.js`);
const { Player } = require(`../../../prisma`);
const { ROLES } = require(`../../../utils/enums`);

/** True when the member holds the MOD or ADMIN operations role
 * @param {GuildMember} member
 */
function hasModAccess(member) {
  const roleCache = member.roles.cache;
  return (
    roleCache.has(ROLES.OPERATIONS.MOD) || roleCache.has(ROLES.OPERATIONS.ADMIN)
  );
}

/** Resolve the invoking moderator's VDC User.id (ModLogs.modID FK target).
 * @param {string} modDiscordID
 * @returns {Promise<string|null>} null when the mod has no linked VDC account
 */
async function resolveModUserID(modDiscordID) {
	let modPlayer;
	try {
		modPlayer = await Player.getBy({ discordID: modDiscordID });
	} catch (error) {
		logger.log(`ERROR`, `resolveModUserID: Player.getBy threw for discord ID \`${modDiscordID}\``, error.stack);
		return null;
	}

	if (!modPlayer) {
		logger.log(`WARNING`, `resolveModUserID: no VDC account found for discord ID \`${modDiscordID}\``);
		return null;
	}

	return modPlayer.id;
}

/** Validate the sanction target; returns an error string or null when valid.
 * @param {ChatInputCommandInteraction} interaction
 * @param {import('discord.js').User} targetUser
 */
function validateTarget(interaction, targetUser) {
  if (targetUser.bot) return `You cannot moderate a bot.`;
  if (targetUser.id === interaction.user.id)
    return `You cannot moderate yourself.`;
  return null;
}

/** Pre-flight check that the bot can actually enforce a mute right now;
 * returns an error string for the mod, or null when enforceable.
 * @param {ChatInputCommandInteraction | import('discord.js').ButtonInteraction} interaction
 * @param {GuildMember} targetMember
 */
function validateMuteEnforceable(interaction, targetMember) {
	const botMember = interaction.guild.members.me;

	if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
		return `I don't have the \`Manage Roles\` permission, so I cannot apply a mute. Please fix my permissions first.`;
	}

	const mutedRole = interaction.guild.roles.cache.get(ROLES.LEAGUE.MUTED);
	if (!mutedRole) {
		return `The Muted role (\`${ROLES.LEAGUE.MUTED}\`) does not exist in this server.`;
	}
	if (botMember.roles.highest.comparePositionTo(mutedRole) <= 0) {
		return `My highest role is at or below the Muted role, so I cannot assign it. Move my role above it.`;
	}

	if (!targetMember.manageable) {
		return `My highest role is at or below ${targetMember}'s highest role, so I cannot change their roles. Move my role above theirs.`;
	}

	return null;
}

/** Pre-flight check that the bot can actually enforce a ban right now;
 * returns an error string for the mod, or null when enforceable.
 * @param {ChatInputCommandInteraction | import('discord.js').ButtonInteraction} interaction
 * @param {GuildMember | null} targetMember null when the target is not in the guild (ban by ID)
 */
function validateBanEnforceable(interaction, targetMember) {
	const botMember = interaction.guild.members.me;

	if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
		return `I don't have the \`Ban Members\` permission, so I cannot ban. Please fix my permissions first.`;
	}

	if (targetMember && !targetMember.bannable) {
		return `My highest role is at or below ${targetMember}'s highest role, so I cannot ban them. Move my role above theirs.`;
	}

	return null;
}

module.exports = { hasModAccess, resolveModUserID, validateTarget, validateMuteEnforceable, validateBanEnforceable };
