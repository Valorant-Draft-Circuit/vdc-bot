const { MessageFlags } = require(`discord.js`);
const { resolvePlayerQueueContext, resolvePriorityBucket } = require(`../../../core/queueState`);
const { getRedisClient, runLua } = require(`../../../core/redis`);

const EVENTS_KEY = `vdc:events`;

async function joinQueue(interaction, queueConfig) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	// check if user has the Inactive or Muted role and deny if so
	if (interaction.member.roles.cache.has(`1060750208746668132`) || interaction.member.roles.cache.has('979222361708589096')) {
		return interaction.editReply({ content: `You are not allowed to join the queue.` });
	}

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

	// determine whether player has completed required combines and should be placed in lower-priority 'completed' sibling
	const queueConfigForUser = queueConfig;
	const gamesPlayed = Number(context.gameCount ?? 0);
	const isReturning = context.leagueStatus && String(context.leagueStatus).toUpperCase() !== `DRAFT_ELIGIBLE`;
	const required = isReturning ? queueConfigForUser.returningPlayerGameReq : queueConfigForUser.newPlayerGameReq;
	const completedSibling = gamesPlayed >= (Number(required) || 0);

	// build keys and append the selected target queue key as an extra KEYS arg (KEYS[8]) so the Lua script can LPUSH into it
	const keys = buildJoinKeys(context.tier, interaction.user.id, completedSibling, priorityBucket);
	const args = [
		interaction.user.id,
		context.tier,
		priorityBucket,
		context.leagueStatus,
		String(Date.now()),
		String(context.mmr ?? 0),
		interaction.guildId ?? ``,
		// pass gameCount explicitly (may be undefined/null/0) so the Lua script can set it
		context.gameCount != null ? String(context.gameCount) : "",
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
		const lines = [];
		if (completedSibling) {
			lines.push(`You're in! Added to **${context.tier}** queue (${priorityBucket}).  As you've completed your required combines, you've been placed in the completed players queue.`);
		} else {
			lines.push(`You're in! Added to **${context.tier}** queue (${priorityBucket}).`);
		}
		lines.push(`• Queue position: ${queueDepth}`);
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

function buildJoinKeys(tier, userId, completedSibling, priorityBucket) {
	const keys = [
		`vdc:league_state`,
		`vdc:tier:${tier}:open`,
		`vdc:tier:${tier}:queue:DE`,
		`vdc:tier:${tier}:queue:FA`,
		`vdc:tier:${tier}:queue:RFA`,
		`vdc:tier:${tier}:queue:SIGNED`,
		`vdc:player:${userId}`,
		EVENTS_KEY,
	];

	if (completedSibling) {
		// choose completed sibling key based on the priority bucket
		let completedKey;
		switch (String(priorityBucket)) {
			case `DE`:
				completedKey = `vdc:tier:${tier}:queue:DE:completed`;
				break;
			case `FA`:
				completedKey = `vdc:tier:${tier}:queue:FA:completed`;
				break;
			case `RFA`:
				completedKey = `vdc:tier:${tier}:queue:RFA:completed`;
				break;
			case `SIGNED`:
				completedKey = `vdc:tier:${tier}:queue:SIGNED:completed`;
				break;
			default:
				completedKey = `vdc:tier:${tier}:queue:DE:completed`;
		}

		// append the explicit target queue key (KEYS[8]) which the Lua script will prefer if present
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
