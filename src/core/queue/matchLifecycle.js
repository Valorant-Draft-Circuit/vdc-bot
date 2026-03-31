const { getRedisClient } = require(`../redis`);
const { getQueueConfig } = require(`./queueconfig`);
const { deleteMatchChannels } = require(`./matchChannels`);
const {
	EVENTS_STREAM_KEY,
	matchKey,
	playerKey,
	playerRecentKey,
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

async function finalizeQueueCombineSubmission({ guild, userId, queueContext, gameID, url }) {
	const redis = getRedisClient();
	const { queueId, queueMatchKey, matchData, tier, players } = queueContext;

	try {
		const pipeline = redis.pipeline();

		pipeline.hset(queueMatchKey, `status`, `completed`);
		pipeline.hset(queueMatchKey, `trackerUrl`, url);
		pipeline.hset(queueMatchKey, `endedAt`, String(Date.now()));

		const affected = new Set(players.filter(Boolean));
		for (const playerId of affected) {
			const key = playerKey(playerId);
			pipeline.hset(key, `status`, `idle`);
			pipeline.hdel(key, `queuePriority`, `queueJoinedAt`, `currentQueueId`);
			pipeline.hincrby(key, `gameCount`, 1);
		}

		try {
			const cfg = await getQueueConfig();
			const recentTtlSeconds = Number(cfg?.recentSetTtlSeconds ?? 180) || 0;
			if (recentTtlSeconds > 0) {
				const affectedArr = Array.from(affected);
				for (const playerId of affectedArr) {
					const recentKey = playerRecentKey(playerId);
					for (const otherId of affectedArr) {
						if (!otherId || otherId === playerId) continue;
						pipeline.sadd(recentKey, otherId);
					}
					pipeline.expire(recentKey, recentTtlSeconds);
				}
			}
		} catch (err) {
			logger.log(`WARNING`, `Failed to apply recent-set anti-rematch updates for ${queueId}`, err);
		}

		await pipeline.exec();

		try {
			const descriptor = parseJsonObject(matchData.channelIdsJSON);
			if (descriptor && guild) {
				await deleteMatchChannels(guild, descriptor);
			}
		} catch (err) {
			logger.log(`WARNING`, `Failed to cleanup channels for submitted match ${queueId}`, err);
		}

		try {
			await redis.xadd(
				EVENTS_STREAM_KEY,
				`*`,
				`type`, `match_completed`,
				`queueId`, String(queueId),
				`gameID`, String(gameID),
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

async function cancelQueueMatch({ guild, queueContext, initiatedBy, yesCount = 0, noCount = 0, yesVoters = [] }) {
	const redis = getRedisClient();
	const { queueId, queueMatchKey, matchData, players } = queueContext;
	const affected = new Set(players.filter(Boolean));

	const pipeline = redis.pipeline();
	for (const playerId of affected) {
		const key = playerKey(playerId);
		pipeline.hset(key, `status`, `idle`);
		pipeline.hdel(key, `queuePriority`, `queueJoinedAt`, `currentQueueId`);
		pipeline.del(playerRecentKey(playerId));
		pipeline.pexpire(key, 43200000);
	}

	pipeline.del(
		queueMatchKey,
		`${queueMatchKey}:cancel_votes_yes`,
		`${queueMatchKey}:cancel_votes_no`,
		`${queueMatchKey}:cancel_active`,
		`${queueMatchKey}:cancel_message_id`,
	);
	await pipeline.exec();

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

	try {
		const descriptor = parseJsonObject(matchData.channelIdsJSON);
		if (descriptor && guild) {
			await deleteMatchChannels(guild, descriptor);
		}
	} catch (err) {
		logger.log(`WARNING`, `Failed to cleanup channels for cancelled match ${queueId}`, err);
	}
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
	finalizeQueueCombineSubmission,
	cancelQueueMatch,
};
