const { MessageFlags } = require(`discord.js`);
const { resolvePlayerQueueContext, resolvePriorityBucket } = require(`../../../core/queueState`);
const { getRedisClient, runLua } = require(`../../../core/redis`);
const { isMmrDisplayEnabled } = require(`../../../core/mmrDisplay`);

const EVENTS_KEY = `vdc:events`;

async function joinQueue(interaction, queueConfig) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const availabilityMessage = await evaluateQueueAvailability(queueConfig);
	if (availabilityMessage) {
		return interaction.editReply({ content: availabilityMessage });
	}

	let context;
	try {
		context = await resolvePlayerQueueContext(interaction.user.id);
	} catch (error) {
		logger.log(`WARNING`, `Queue join failed while resolving player context`, `${interaction.user.tag} (${interaction.user.id}) :: ${error?.message || error}`);
		return interaction.editReply({
			content: mapContextErrorToMessage(error),
		});
	}

	if (queueConfig.perTierFlags) {
		const configured = queueConfig.perTierFlags[context.tier];
		if (configured === false) {
			return interaction.editReply({
				content: `The ${context.tier} queue is currently closed by configuration.`,
			});
		}
	}

	let priorityBucket;
	try {
		priorityBucket = resolvePriorityBucket(context.leagueStatus);
	} catch (error) {
		return interaction.editReply({
			content: mapContextErrorToMessage(error),
		});
	}

	const redis = getRedisClient();

	const keys = buildJoinKeys(context.tier, interaction.user.id);
	const args = [
		interaction.user.id,
		context.tier,
		priorityBucket,
		context.leagueStatus,
		String(Date.now()),
		String(context.mmr ?? 0),
		interaction.guildId ?? ``,
	];

	try {
		const response = await runLua(`join`, { keys, args });
		const payload = parseLuaJson(response);

		if (!payload.ok) {
			return interaction.editReply({
				content: mapJoinErrorToMessage(payload, context.tier),
			});
		}

		await redis.sadd(`vdc:tiers`, context.tier);

		const queueDepth = payload.queueDepth ?? `unknown`;
		const lines = [
			`You're in! Added to **${context.tier}** queue (${priorityBucket}).`,
			`• Queue position: ${queueDepth}`,
			`• League status: ${context.leagueStatus}`,
		];

		if (await isMmrDisplayEnabled()) {
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
			return `We couldn't find your player profile. Please ensure you're registered for Combines.`;
		case `MMR_NOT_AVAILABLE`:
			return `We couldn't determine your MMR. Please reach out to staff to validate your player profile.`;
		case `TIER_NOT_RESOLVED`:
			return `We couldn't determine your tier. Please reach out to staff to validate your player profile.`;
		case `INELIGIBLE_STATUS`:
			return `Your current league status doesn't allow queueing for Combines.`;
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
		case `ON_COOLDOWN`:
			return `You're on cooldown. Try again once it expires.`;
		case `DUPLICATE_IN_QUEUE`:
			return `You are already listed in the queue. If this persists, contact an admin.`;
		default:
			return `Queue join failed (${code}). Please try again shortly.`;
	}
}

function buildJoinKeys(tier, userId) {
	return [
		`vdc:league_state`,
		`vdc:tier:${tier}:open`,
		`vdc:tier:${tier}:queue:DE`,
		`vdc:tier:${tier}:queue:FA_RFA`,
		`vdc:tier:${tier}:queue:SIGNED`,
		`vdc:player:${userId}`,
		EVENTS_KEY,
	];
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
