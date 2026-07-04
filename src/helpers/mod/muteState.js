const fs = require(`fs`);
const path = require(`path`);
const { ModLogType } = require(`@prisma/client`);
const { prisma } = require(`../../../prisma/prismadb`);
const { MOD_TOOLS_EPOCH } = require(`../../../prisma`);
const { getRedisClient } = require(`../../core/redis`);

const MUTE_CACHE_PATH = path.resolve(__dirname, `../../../cache/muteCache.json`);
const EXPIRY_KEY_PREFIX = `vdc:mod:expiry:`;
const MUTE_ROLES_KEY_PREFIX = `vdc:mod:muteroles:`;

/** Persist the stripped role IDs (no TTL - survives until unmute).
 * If Redis is ever wiped, unmute still recovers league roles via the
 * profile rebuild; only unmanaged cosmetic roles would be lost. */
async function saveMuteState(discordID, roleIds) {
	await getRedisClient().set(`${MUTE_ROLES_KEY_PREFIX}${discordID}`, JSON.stringify(roleIds));
	await rewriteMuteCache();
}

/** @returns {Promise<string[]|null>} the snapshot role IDs, or null */
async function getMuteState(discordID) {
	const raw = await getRedisClient().get(`${MUTE_ROLES_KEY_PREFIX}${discordID}`);
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

async function clearMuteState(discordID) {
	await getRedisClient().del(`${MUTE_ROLES_KEY_PREFIX}${discordID}`).catch(() => undefined);
	await rewriteMuteCache();
}

/** Rewrite cache/muteCache.json from active MUTE rows (hot-reloaded by bot.js) */
async function rewriteMuteCache() {
	const activeMutes = await prisma.modLogs.findMany({
		where: { type: ModLogType.MUTE, date: { gte: MOD_TOOLS_EPOCH }, OR: [{ expires: null }, { expires: { gt: new Date() } }] },
		select: { discordID: true },
		distinct: [`discordID`],
	});
	fs.writeFileSync(MUTE_CACHE_PATH, JSON.stringify(activeMutes.map((m) => m.discordID)));
}

function expiryKey(type, discordID) {
	return `${EXPIRY_KEY_PREFIX}${type}:${discordID}`;
}

/** Set the TTL wake-up key for a timed punishment (no key for permanent).
 * Enforcement work (DM, DB write, role ops) takes seconds, so a very short
 * duration can already be past by the time we arm the key - clamp to a 1s
 * minimum instead of skipping, so the lift still fires immediately. */
async function setExpiryKey(type, discordID, expires) {
	if (!expires) return;
	const ttlSeconds = Math.max(1, Math.ceil((expires.getTime() - Date.now()) / 1000));
	await getRedisClient().set(expiryKey(type, discordID), `1`, `EX`, ttlSeconds);
}

async function clearExpiryKey(type, discordID) {
	await getRedisClient().del(expiryKey(type, discordID)).catch(() => undefined);
}

module.exports = {
	saveMuteState, getMuteState, clearMuteState, rewriteMuteCache,
	setExpiryKey, clearExpiryKey, EXPIRY_KEY_PREFIX, MUTE_CACHE_PATH,
};
