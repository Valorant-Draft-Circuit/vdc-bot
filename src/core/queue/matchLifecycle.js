const { getRedisClient, runLua } = require(`../redis`);
const { getQueueConfig } = require(`./queueconfig`);
const { deleteMatchChannels } = require(`./matchChannels`);
const {
	EVENTS_STREAM_KEY,
	matchKey,
	playerKey,
} = require(`../../helpers/queue/queueKeys`);

async function resolveCurrentQueueId(userId) {
	const redis = getRedisClient();
	const [status, currentQueueId] = await redis.hmget(playerKey(userId), `status`, `currentQueueId`);
	if (String(status) !== `in_match` || !currentQueueId) return null;
	return String(currentQueueId);
}

async function getQueueMatchContext(queueId) {
	const redis = getRedisClient();
	const queueMatchKey = matchKey(queueId);
	const matchData = await redis.hgetall(queueMatchKey);
	if (!matchData || Object.keys(matchData).length === 0) return null;

	const teamA = parseJsonArray(matchData.teamAJSON);
	const teamB = parseJsonArray(matchData.teamBJSON);
	const players = Array.from(new Set([...(teamA || []), ...(teamB || [])]));

	return {
		queueId: String(queueId),
		queueMatchKey,
		matchData,
		tier: matchData.tier,
		players,
		teamA: teamA || [],
		teamB: teamB || [],
	};
}

async function isUserBoundToQueueMatch(userId, queueId) {
	const redis = getRedisClient();
	const [status, currentQueueId] = await redis.hmget(playerKey(userId), `status`, `currentQueueId`);
	return String(status) === `in_match` && String(currentQueueId) === String(queueId);
}

async function resolveQueueSubmissionContext(userId) {
	const queueId = await resolveCurrentQueueId(userId);
	if (!queueId) return null;

	const context = await getQueueMatchContext(queueId);
	if (!context) return null;
	if (!context.players.includes(userId)) return null;

	return context;
}

/**
 * Fallback for a submitter who isn't bound to the match (a sub, or someone outside the lobby):
 * the queue match most of the game's players are bound to.
 * @param {string[]} userIds Discord IDs of the players in the submitted game
 */
async function resolveQueueContextFromPlayers(userIds) {
	if (!userIds.length) return null;

	const redis = getRedisClient();
	const pipeline = redis.pipeline();
	for (const userId of userIds) pipeline.hmget(playerKey(userId), `status`, `currentQueueId`);
	const results = await pipeline.exec();

	const votes = new Map();
	for (const [error, fields] of results) {
		if (error || !fields) continue;
		const [status, queueId] = fields;
		if (String(status) === `in_match` && queueId) votes.set(String(queueId), (votes.get(String(queueId)) ?? 0) + 1);
	}

	const [queueId] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
	if (!queueId) return null;

	const context = await getQueueMatchContext(queueId);
	if (!context) return null;

	// most of the lobby has to be in the game, so a stray link can't close someone else's match
	const overlap = context.players.filter((id) => userIds.includes(id)).length;
	return overlap * 2 > context.players.length ? context : null;
}

/**
 * Release a queue match's players via release_match.lua, which only touches players still bound to it.
 * @param {string} queueId
 * @param {`complete` | `cancel` | `requeue`} mode
 * @returns {Promise<{ ok: boolean, error?: string, released: string[], skipped: string[] }>}
 */
async function releaseQueueMatch(queueId, mode, { url = ``, recentTtlSeconds = 0 } = {}) {
	const response = await runLua(`release_match`, {
		keys: [matchKey(queueId)],
		args: [String(queueId), mode, String(Date.now()), url ?? ``, String(recentTtlSeconds)],
	});
	const payload = typeof response === `string` ? JSON.parse(response) : (response ?? {});

	// cjson encodes empty arrays as {}
	const released = Array.isArray(payload.released) ? payload.released : [];
	const skipped = Array.isArray(payload.skipped) ? payload.skipped : [];
	if (skipped.length) {
		logger.log(`WARNING`, `Queue match ${queueId} ${mode}: left ${skipped.length} player(s) alone who had already moved on: ${skipped.join(`, `)}`);
	}

	return { ...payload, released, skipped };
}

/** Marks the match completed and unlocks its players. Callers delete the channels with deleteQueueMatchChannels. */
async function finalizeQueueCombineSubmission({ userId, queueContext, gameID, url }) {
	const redis = getRedisClient();
	const { queueId, tier, players } = queueContext;

	try {
		const cfg = await getQueueConfig().catch((err) => {
			logger.log(`WARNING`, `Failed to load queue config for recent-set anti-rematch updates for ${queueId}`, err);
			return null;
		});
		const result = await releaseQueueMatch(queueId, `complete`, {
			url,
			recentTtlSeconds: Number(cfg?.recentSetTtlSeconds ?? 180) || 0,
		});
		// ALREADY_COMPLETED means another submit got there first; it handled the cleanup below
		if (!result.ok) {
			logger.log(`WARNING`, `Skipped finalizing queue match ${queueId} for game ${gameID}: ${result.error}`);
			return false;
		}

		try {
			await redis.xadd(
				EVENTS_STREAM_KEY,
				`*`,
				`type`, `match_completed`,
				`queueId`, String(queueId),
				`gameID`, String(gameID ?? ``),
				`tier`, String(tier ?? ``),
				`initiatedBy`, String(userId),
				`timestamp`, String(Date.now()),
				`players`, JSON.stringify(players),
			);
		} catch (err) {
			logger.log(`WARNING`, `Failed to emit match_completed event for ${queueId}`, err);
		}

		return true;
	} catch (err) {
		logger.log(`WARNING`, `Failed to update Redis state/unlock players for submitted match ${gameID}`, err);
		return false;
	}
}

/** Deletes the match and unlocks its players. Callers delete the channels with deleteQueueMatchChannels. */
async function cancelQueueMatch({ queueContext, initiatedBy, yesCount = 0, noCount = 0, yesVoters = [] }) {
	const redis = getRedisClient();
	const { queueId, matchData, players } = queueContext;

	// MATCH_NOT_FOUND means a concurrent cancel or kill already released it and cleaned up
	const result = await releaseQueueMatch(queueId, `cancel`);
	if (!result.ok) return false;

	try {
		const tier = matchData.tier ?? ``;
		await redis.xadd(
			EVENTS_STREAM_KEY,
			`*`,
			`type`, `match_canceled`,
			`queueId`, String(queueId),
			`tier`, String(tier),
			`timestamp`, String(Date.now()),
			`initiatedBy`, String(initiatedBy ?? ``),
			`yesCount`, String(yesCount),
			`noCount`, String(noCount),
			`players`, JSON.stringify(players),
			`yesVoters`, JSON.stringify(yesVoters || []),
		);
	} catch (err) {
		logger.log(`WARNING`, `Failed to emit match_canceled event for ${queueId}`, err);
	}

	return true;
}

/**
 * Delete a queue match's channels. Call it after replying to the command that closed the match: when
 * that command is run in the lobby's chat, deleting first makes the reply fail with Unknown Message.
 */
async function deleteQueueMatchChannels(guild, queueContext) {
	const descriptor = parseJsonObject(queueContext.matchData?.channelIdsJSON);
	if (!descriptor || !guild) return;

	try {
		await deleteMatchChannels(guild, descriptor);
	} catch (err) {
		logger.log(`WARNING`, `Failed to cleanup channels for match ${queueContext.queueId}`, err);
	}
}

/**
 * Undo a match whose lobby couldn't be set up: its players go back to the front of the queue.
 * @param {string} queueId
 * @param {string} reason
 */
async function requeueQueueMatch(queueId, reason) {
	const result = await releaseQueueMatch(queueId, `requeue`);
	if (!result.ok) return result;

	try {
		await getRedisClient().xadd(
			EVENTS_STREAM_KEY,
			`*`,
			`type`, `match_canceled`,
			`queueId`, String(queueId),
			`tier`, String(result.tier ?? ``),
			`timestamp`, String(Date.now()),
			`initiatedBy`, `system`,
			`reason`, String(reason ?? ``),
			`players`, JSON.stringify(result.released),
		);
	} catch (err) {
		logger.log(`WARNING`, `Failed to emit match_canceled event for requeued match ${queueId}`, err);
	}

	return result;
}

function parseJsonArray(payload) {
	if (typeof payload !== `string`) return [];
	try {
		const parsed = JSON.parse(payload);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function parseJsonObject(payload) {
	if (typeof payload !== `string`) return null;
	try {
		const parsed = JSON.parse(payload);
		return parsed && typeof parsed === `object` ? parsed : null;
	} catch {
		return null;
	}
}

module.exports = {
	resolveCurrentQueueId,
	getQueueMatchContext,
	isUserBoundToQueueMatch,
	resolveQueueSubmissionContext,
	resolveQueueContextFromPlayers,
	releaseQueueMatch,
	finalizeQueueCombineSubmission,
	cancelQueueMatch,
	deleteQueueMatchChannels,
	requeueQueueMatch,
};
