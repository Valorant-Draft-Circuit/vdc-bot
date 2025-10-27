const { LeagueStatus } = require(`@prisma/client`);
const { Player } = require(`../../prisma`);

const ALLOWED_STATUSES = new Set([
	LeagueStatus.DRAFT_ELIGIBLE,
	LeagueStatus.FREE_AGENT,
	LeagueStatus.RESTRICTED_FREE_AGENT,
	LeagueStatus.SIGNED,
	LeagueStatus.GENERAL_MANAGER
].map(String));

const BUCKET_BY_STATUS = new Map([
	[LeagueStatus.DRAFT_ELIGIBLE, `DE`],
	[LeagueStatus.FREE_AGENT, `FA`],
	[LeagueStatus.RESTRICTED_FREE_AGENT, `RFA`],
	[LeagueStatus.SIGNED, `SIGNED`],
	[LeagueStatus.GENERAL_MANAGER, `SIGNED`]
]);

/**
 * Resolve a player's queue-relevant context (league status, tier, MMR) using cache with DB fallback.
 * @param {string} discordId
 * @returns {Promise<{ leagueStatus: string, tier: string, mmr: number, dataSource: 'cache'|'database' }>}
 */
async function resolvePlayerQueueContext(discordId) {
	const cacheHit = readFromMmrCache(discordId);
	if (cacheHit && cacheHit.leagueStatus && cacheHit.tier && cacheHit.mmr != null) {
		// try to read live gameCount from Redis player hash first
		const gameCount = await readGameCountFromRedis(discordId);
		return { ...cacheHit, dataSource: `cache`, gameCount };
	}

	const dbRecord = await Player.getBy({ discordID: discordId });
	if (!dbRecord || !dbRecord.Status) {
		throw new Error(`PLAYER_NOT_FOUND`);
	}

	const leagueStatus = String(dbRecord.Status.leagueStatus);
	const mmr = extractMmrFromRecord(dbRecord);
	if (mmr == null) {
		throw new Error(`MMR_NOT_AVAILABLE`);
	}

	const tier = deriveTierFromMmr(mmr);
	if (!tier) {
		throw new Error(`TIER_NOT_RESOLVED`);
	}

	const gameCount = await readGameCountFromRedis(discordId);
	return {
		leagueStatus,
		tier,
		mmr,
		dataSource: `database`,
		gameCount,
	};
}

async function readGameCountFromRedis(discordId) {
	try {
		const { getRedisClient } = require(`./redis`);
		const redis = getRedisClient();
		const key = `vdc:player:${discordId}`;
		const val = await redis.hget(key, `gameCount`);
		if (val != null) return Number(val);
	} catch (err) {
		// ignore and fall back to file cache
	}

	// fallback to combineCountCache.json loaded into global
	try {
		const cache = global.combineCountCache;
		if (Array.isArray(cache)) {
			const entry = cache.find((r) => r.discordID === discordId || r.discordId === discordId);
			if (entry && entry.gameCount != null) return Number(entry.gameCount);
			if (entry && entry.gamesPlayed != null) return Number(entry.gamesPlayed);
		}
	} catch (err) {
		// ignore
	}

	return 0;
}

/**
 * Determine the matchmaking tier from cached tier lines.
 * @param {number} mmr
 * @returns {string|undefined}
 */
function deriveTierFromMmr(mmr) {
	if (typeof mmr !== `number` || Number.isNaN(mmr)) return undefined;

	const tierLines = global.mmrTierLinesCache ?? {};
	for (const [tier, range] of Object.entries(tierLines)) {
		if (typeof range !== `object` || range == null) continue;
		if (typeof range.min !== `number` || typeof range.max !== `number`) continue;
		if (range.min <= mmr && mmr <= range.max) return tier;
	}

	return undefined;
}

/**
 * Determine which priority bucket a player belongs to.
 * @param {string} leagueStatus
 * @returns {string}
 */
function resolvePriorityBucket(leagueStatus) {
	const normalized = String(leagueStatus);
	if (!ALLOWED_STATUSES.has(normalized)) {
		throw new Error(`INELIGIBLE_STATUS`);
	}

	return BUCKET_BY_STATUS.get(normalized) ?? `DE`;
}

function readFromMmrCache(discordId) {
	const cache = global.mmrCache;
	if (!Array.isArray(cache)) return null;

	const entry = cache.find((row) => row.discordID === discordId);
	if (!entry) return null;

	const mmr = typeof entry.mmr === `number` ? entry.mmr : Number(entry.mmr);
	const tier = deriveTierFromMmr(mmr);
	const leagueStatus = entry.ls ? String(entry.ls) : undefined;

	if (!leagueStatus || !ALLOWED_STATUSES.has(leagueStatus)) return null;
	if (!tier) return null;

	return { leagueStatus, tier, mmr };
}

function extractMmrFromRecord(record) {
	if (!record) return null;

	const primaryMmr = record.PrimaryRiotAccount?.MMR;
	if (primaryMmr) {
		if (primaryMmr.mmrEffective != null) return Number(primaryMmr.mmrEffective);
	}

	if (Array.isArray(record.Accounts)) {
		for (const account of record.Accounts) {
			if (account.MMR) {
				if (account.MMR.mmrEffective != null) return Number(account.MMR.mmrEffective);
			}
		}
	}

	return null;
}

module.exports = {
	resolvePlayerQueueContext,
	resolvePriorityBucket,
	deriveTierFromMmr,
	ALLOWED_STATUSES,
};
