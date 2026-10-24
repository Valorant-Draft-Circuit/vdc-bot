const { MessageFlags, time, TimestampStyles } = require(`discord.js`);
const { resolvePlayerQueueContext, resolvePriorityBucket } = require(`../../../helpers/queue/queueState`);
const { getRedisClient, runLua } = require(`../../../core/redis`);
const {
	LEAGUE_STATE_KEY,
	TIERS_SET_KEY,
	EVENTS_STREAM_KEY,
	tierOpenKey,
	tierQueueKey,
	tierQueueKeys,
	playerKey,
} = require(`../../../helpers/queue/queueKeys`);
const { ROLES } = require(`../../../../utils/enums`);
const { queueEvent } = require(`../../../core/queue/events`);

//TODO: Move these roles to enums
const INACTIVE_ROLE_ID = `1060750208746668132`;
const PRIORITY_BUCKETS = new Set([`DE`, `FA`, `RFA`, `SIGNED`]);

async function joinQueue(interaction, queueConfig) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	// every refusal is a queue event, so "why can't I join?" can be answered from Grafana
	const reject = (reason, content, tier) => {
		queueEvent(`queue_join_rejected`, { userId: interaction.user.id, tier, reason });
		return interaction.editReply({ content });
	};

	if (interaction.member.roles.cache.has(INACTIVE_ROLE_ID) || interaction.member.roles.cache.has(ROLES.LEAGUE.MUTED)) {
		return reject(`ROLE_BLOCKED`, `You are not allowed to join the queue.`);
	}

	const availabilityMessage = await evaluateQueueAvailability(queueConfig);
	if (availabilityMessage) {
		return reject(`QUEUES_DISABLED`, availabilityMessage);
	}

	let context;
	try {
		context = await resolvePlayerQueueContext(interaction.user.id);
	} catch (error) {
		logger.log(
			`WARNING`,
			`Queue join failed while resolving player context`,
			`${interaction.user.tag} (${interaction.user.id}) :: ${error?.message || error}`,
		);
		return reject(String(error?.message || error), mapContextErrorToMessage(error));
	}

	if (!context.mmr || context.mmr === 0) {
		logger.log(
			`ALERT`,
			`Queue join failed due to invalid MMR`,
			`${interaction.user.tag} (${interaction.user.id}) :: MMR: ${context.mmr}`,
		);
		return reject(`INVALID_MMR`, `Your MMR appears to be invalid. Please create a ticket to resolve this issue.`, context.tier);
	}

	if (queueConfig.perTierFlags) {
		const configured = queueConfig.perTierFlags[context.tier];
		if (configured === false) {
			return reject(`TIER_CLOSED_BY_CONFIG`, `The ${context.tier} queue is currently closed by configuration.`, context.tier);
		}
	}

	let priorityBucket;
	try {
		priorityBucket = resolvePriorityBucket(context.leagueStatus);
	} catch (error) {
		return reject(String(error?.message || error), mapContextErrorToMessage(error), context.tier);
	}

	const redis = getRedisClient();

	const queueConfigForUser = queueConfig;
	const gamesPlayed = Number(context.gameCount ?? 0);
	const isReturning = context.leagueStatus && String(context.leagueStatus).toUpperCase() !== `DRAFT_ELIGIBLE`;
	const required = isReturning ? queueConfigForUser.returningPlayerGameReq : queueConfigForUser.newPlayerGameReq;
	const completedSibling = gamesPlayed >= (Number(required) || 0);

	const keys = buildJoinKeys(context.tier, interaction.user.id, completedSibling, priorityBucket);
	const args = [
		interaction.user.id,
		context.tier,
		priorityBucket,
		context.leagueStatus,
		String(Date.now()),
		String(context.mmr),
		interaction.guildId ?? ``,
		context.gameCount != null ? String(context.gameCount) : ``,
	];

	try {
		const response = await runLua(`join`, { keys, args });
		const payload = parseLuaJson(response);

		if (!payload.ok) {
			return reject(payload.error ?? `UNKNOWN`, mapJoinErrorToMessage(payload, context.tier), context.tier);
		}

		queueEvent(`queue_join`, {
			userId: interaction.user.id,
			tier: context.tier,
			bucket: priorityBucket,
			completed: completedSibling,
			leagueStatus: context.leagueStatus,
			mmr: context.mmr,
		});
		await redis.sadd(TIERS_SET_KEY, context.tier);

		let tierQueueCount = `unknown`;
		try {
			const listKeys = tierQueueKeys(context.tier, { includeCompleted: true });

			const counts = await Promise.all(
				listKeys.map((k) => redis.llen(k).catch(() => 0)),
			);
			const sum = counts.reduce((acc, v) => acc + (Number(v) || 0), 0);
			tierQueueCount = sum;
		} catch (err) {
			logger.log && logger.log(`WARNING`, `Failed to compute tier queue count for ${context.tier}`, err);
		}

		const lines = [];
		if (completedSibling) {
			lines.push(`You're in! Added to **${context.tier}** queue (${priorityBucket}).  As you've completed your required combines, you've been placed in the completed players queue.`);
		} else {
			lines.push(`You're in! Added to **${context.tier}** queue (${priorityBucket}).`);
		}
		lines.push(`• Players in tier queue: ${tierQueueCount}`);
		lines.push(`• League status: ${context.leagueStatus}`);

		if (queueConfig?.displayMmr) {
			lines.push(`• MMR: ${context.mmr}`);
		}

		return interaction.editReply({ content: lines.join(`\n`) });
	} catch (error) {
		logger.log(`ERROR`, `Queue join failed`, error);
		return interaction.editReply({
			content: `Something went wrong while joining the queue. Please try again shortly.`,
		});
	}
}

async function evaluateQueueAvailability(queueConfig) {
	if (!queueConfig.enabled) return `Queues are currently disabled.`;
	return null;
}

function mapContextErrorToMessage(error) {
	const code = error?.message || error;
	switch (code) {
		case `PLAYER_NOT_FOUND`:
			return `We couldn't find your player profile. Please ensure you're registered for VDC.`;
		case `MMR_NOT_AVAILABLE`:
			return `We couldn't determine your MMR. Please create a ticket.`;
		case `TIER_NOT_RESOLVED`:
			return `We couldn't determine your tier. Please create a ticket.`;
		case `INELIGIBLE_STATUS`:
			return `Your current league status doesn't allow queueing for Combines.  Please create a ticket if you believe this is an error.`;
		default:
			return `Unable to resolve your queue profile (${code}). Please try again later.`;
	}
}

function mapJoinErrorToMessage(payload, tier) {
	const code = payload?.error ?? `UNKNOWN`;
	switch (code) {
		case `LEAGUE_STATE_NOT_COMBINES`:
			return `Queues only run during Combines.`;
		case `TIER_CLOSED`:
			return `The ${tier} queue is currently closed.`;
		case `ALREADY_QUEUED`:
			return `You're already queued for ${payload.details?.tier ?? tier}.`;
		case `IN_MATCH`:
			return `You're currently in a match (${payload.details?.queueId ?? `unknown`}).`;
		case `PLAYER_LOCKED`:
			return `You're locked from queueing until staff unlocks you.`;
		case `PLAYER_SUSPENDED`: {
			const until = Number(payload.details?.suspendedUntil);
			return until
				? `You're suspended from the queue. Your suspension ends ${time(Math.floor(until / 1000), TimestampStyles.RelativeTime)}.`
				: `You're suspended from the queue. Please create a ticket if you believe this is an error.`;
		}
		case `ON_COOLDOWN`:
			return `You're on cooldown. Try again once it expires.`;
		default:
			return `Queue join failed (${code}). Please try again shortly.`;
	}
}

function buildJoinKeys(tier, userId, completedSibling, priorityBucket) {
	const keys = [
		LEAGUE_STATE_KEY,
		tierOpenKey(tier),
		tierQueueKey(tier, `DE`),
		tierQueueKey(tier, `FA`),
		tierQueueKey(tier, `RFA`),
		tierQueueKey(tier, `SIGNED`),
		playerKey(userId),
		EVENTS_STREAM_KEY,
	];

	if (completedSibling) {
		const bucket = PRIORITY_BUCKETS.has(String(priorityBucket))
			? String(priorityBucket)
			: `DE`;
		const completedKey = tierQueueKey(tier, bucket, { completed: true });

		keys.push(completedKey);
	}

	return keys;
}

function parseLuaJson(payload) {
	if (payload == null) return {};
	if (typeof payload === `string`) {
		try {
			return JSON.parse(payload);
		} catch (error) {
			logger.log(`ERROR`, `Failed to parse Lua script response`, error);
			return {};
		}
	}
	return payload;
}

module.exports = {
	joinQueue,
};
