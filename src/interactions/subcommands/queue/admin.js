const { MessageFlags, EmbedBuilder } = require(`discord.js`);
const { Tier } = require(`@prisma/client`);
const { ROLES } = require(`../../../../utils/enums/roles`);
const { getRedisClient } = require(`../../../core/redis`);
const { getQueueConfig, invalidateQueueConfigCache } = require(`../../../core/queue/queueconfig`);
const { deleteMatchChannels } = require(`../../../core/queue/matchChannels`);
const {
	TIERS_SET_KEY,
	tierOpenKey,
	tierQueueKey,
	tierQueueKeys,
	playerKey,
	playerRecentKey,
	matchKey,
	matchKeyPattern,
	queueIdFromMatchKey,
} = require(`../../../helpers/queue/queueKeys`);

async function handleAdminCommand(interaction, queueConfig, subcommand) {
	const actorLabel = `${interaction.user.tag} (${interaction.user.id})`;

	switch (subcommand) {
		case `status`: {
			const { getMatchmakerStatus } = require(`../../../workers/matchmaker`);
			const embed = await buildQueueStatusEmbed(queueConfig, getMatchmakerStatus());
			return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
		}

		case `open`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const tierSelection = interaction.options.getString(`tier`, true).toUpperCase();
			const tiers = await resolveTiers(tierSelection);
			if (tiers.length === 0) {
				return interaction.editReply({ content: `No tiers matched \"${tierSelection}\".` });
			}

			await setTierState(tiers, true);
			logger.log(`INFO`, `Queue admin open executed by ${actorLabel} for tiers [${tiers.join(`, `)}]`);
			return interaction.editReply({ content: buildTierStateMessage(tiers, true) });
		}

		case `close`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const tierSelection = interaction.options.getString(`tier`, true).toUpperCase();
			const tiers = await resolveTiers(tierSelection);
			if (tiers.length === 0) {
				return interaction.editReply({ content: `No tiers matched \"${tierSelection}\".` });
			}

			await setTierState(tiers, false);
			logger.log(`INFO`, `Queue admin close executed by ${actorLabel} for tiers [${tiers.join(`, `)}]`);
			return interaction.editReply({ content: buildTierStateMessage(tiers, false) });
		}

		case `reload-config`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			logger.log(`INFO`, `Queue admin config reload executed by ${actorLabel}`);
			const { syncLeagueStateFromControlPanel } = require(`../../../core/queue/bootstrap`);
			await invalidateQueueConfigCache();
			await getQueueConfig({ forceRefresh: true });
			await syncLeagueStateFromControlPanel();
			return interaction.editReply({
				content: `Queue configuration cache reloaded. If you want to refresh game count cache please use /debug refresh-cache.`,
			});
		}

		case `build`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			if (!queueConfig.enabled) {
				return interaction.editReply({
					content: `Queue system is disabled in ControlPanel (queue_enabled=false). Enable it before running build.`,
				});
			}
			const tierSelection = interaction.options.getString(`tier`, true).toUpperCase();
			const { runMatchmakerOnce } = require(`../../../workers/matchmaker`);
			const ran = await runMatchmakerOnce(interaction.client, tierSelection);
			if (!ran) {
				return interaction.editReply({
					content: `Build skipped because queue is disabled in ControlPanel (queue_enabled=false).`,
				});
			}
			logger.log(`INFO`, `Queue admin build triggered by ${actorLabel} for ${tierSelection}`);
			return interaction.editReply({
				content:
					tierSelection === `ALL`
						? `Triggered the matchmaker for all tiers.`
						: `Triggered the matchmaker for ${tierSelection}.`,
			});
		}

		case `start-matchmaker`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			if (!(/true/i).test(process.env.QUEUE_SYSTEM_ENABLED)) {
				return interaction.editReply({
					content: `Queue system is disabled by environment configuration (QUEUE_SYSTEM_ENABLED).`,
				});
			}
			if (!queueConfig.enabled) {
				return interaction.editReply({
					content: `Queue system is disabled in ControlPanel (queue_enabled=false). Enable it before starting matchmaker.`,
				});
			}

			const { startMatchmaker, getMatchmakerStatus } = require(`../../../workers/matchmaker`);
			const before = getMatchmakerStatus();
			await startMatchmaker(interaction.client);
			const after = getMatchmakerStatus();

			logger.log(`INFO`, `Queue admin start-matchmaker executed by ${actorLabel}`);
			return interaction.editReply({
				content: before.running
					? `Matchmaker is already running.`
					: `Matchmaker started successfully (interval ${after.intervalMs ?? `unknown`}ms).`,
			});
		}

		case `stop-matchmaker`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const reason = interaction.options.getString(`reason`) || `Stopped manually by queue admin`;
			const { stopMatchmaker, getMatchmakerStatus } = require(`../../../workers/matchmaker`);
			const before = getMatchmakerStatus();
			stopMatchmaker({ reason, source: `queueadmin` });

			logger.log(`INFO`, `Queue admin stop-matchmaker executed by ${actorLabel}: ${reason}`);
			return interaction.editReply({
				content: before.running
					? `Matchmaker stopped. Reason: ${reason}`
					: `Matchmaker was already stopped.`,
			});
		}

		case `restart-matchmaker`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			if (!(/true/i).test(process.env.QUEUE_SYSTEM_ENABLED)) {
				return interaction.editReply({
					content: `Queue system is disabled by environment configuration (QUEUE_SYSTEM_ENABLED).`,
				});
			}
			if (!queueConfig.enabled) {
				return interaction.editReply({
					content: `Queue system is disabled in ControlPanel (queue_enabled=false). Enable it before restarting matchmaker.`,
				});
			}

			const { stopMatchmaker, startMatchmaker, getMatchmakerStatus } = require(`../../../workers/matchmaker`);
			stopMatchmaker({ reason: `Restarted manually by queue admin`, source: `queueadmin` });
			await startMatchmaker(interaction.client);
			const after = getMatchmakerStatus();

			logger.log(`INFO`, `Queue admin restart-matchmaker executed by ${actorLabel}`);
			return interaction.editReply({
				content: `Matchmaker restarted successfully (interval ${after.intervalMs ?? `unknown`}ms).`,
			});
		}

		case `end-warmup`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			if (!(/true/i).test(process.env.QUEUE_SYSTEM_ENABLED)) {
				return interaction.editReply({
					content: `Queue system is disabled by environment configuration (QUEUE_SYSTEM_ENABLED).`,
				});
			}

			const { getMatchmakerStatus, endWarmupNow } = require(`../../../workers/matchmaker`);
			const status = getMatchmakerStatus();
			if (!status.running) {
				return interaction.editReply({
					content: `Matchmaker is not running, so there is no active warmup to end.`,
				});
			}

			const result = endWarmupNow({ source: `queueadmin` });
			logger.log(`INFO`, `Queue admin end-warmup executed by ${actorLabel}`);

			if (!result.activeBefore) {
				return interaction.editReply({ content: `Warmup is already inactive.` });
			}

			return interaction.editReply({ content: `Warmup ended early. Matchmaker now runs at normal cadence.` });
		}

		case `kill`: {
			const queueId = interaction.options.getString(`queue_id`, true);
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const result = await killMatch(interaction.client, queueId, actorLabel);
			await interaction.editReply({ content: result.message });

			if (result.matchRecord) {
				try {
					await cleanupMatchChannels(interaction.client, result.matchRecord, queueId);
				} catch (error) {
					logger.log(`WARNING`, `Failed to cleanup channels for ${queueId}`, error);
				}
			}

			return;
		}

		case `reset`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const result = await resetQueues(interaction.client, actorLabel);
			return interaction.editReply({ content: result });
		}

		case `create-dummies`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const tierSelection = interaction.options.getString(`tier`, true).toUpperCase();
			const count = Math.min(Math.max(interaction.options.getInteger(`count`, true) || 0, 1), 50);
			const bucket = interaction.options.getString(`bucket`, true);
			const games = interaction.options.getInteger(`games`) ?? null;
			const completedFlag = interaction.options.getBoolean(`completed`) ?? false;
			const redis = getRedisClient();

			const validBuckets = new Set([`DE`, `FA`, `RFA`, `SIGNED`]);
			if (!validBuckets.has(bucket)) {
				return interaction.editReply({ content: `Invalid bucket type: ${bucket}` });
			}

			const created = [];
			for (let i = 0; i < count; i++) {
				const dummyId = `dummy_${Date.now().toString(36)}_${Math.floor(Math.random() * 100000)}_${i}`;
				const dummyPlayerKey = playerKey(dummyId);
				const nowMs = Date.now().toString();
				const hashPayload = {
					status: `queued`,
					tier: tierSelection,
					queueJoinedAt: nowMs,
					mmr: `1000`,
					guildId: ``,
				};
				if (typeof games === `number`) hashPayload.gameCount = String(games);
				await redis.hset(dummyPlayerKey, hashPayload);
				await redis.pexpire(dummyPlayerKey, 300000);
				const queueKey = completedFlag
					? tierQueueKey(tierSelection, bucket, { completed: true })
					: tierQueueKey(tierSelection, bucket);
				await redis.rpush(queueKey, dummyId);
				created.push({ id: dummyId, queueKey });
			}

			logger.log(`INFO`, `Queue admin create-dummies executed by ${actorLabel} — created ${created.length} dummies for ${tierSelection} in ${bucket}`);
			return interaction.editReply({ content: `Created and queued ${created.length} dummy players in ${tierSelection} / ${bucket}.` });
		}
	}
}

async function resolveTiers(selection) {
	const redis = getRedisClient();
	const knownTiers = new Set(
		Object.values(Tier)
			.filter((value) => typeof value === `string` && String(value).toUpperCase() !== `MIXED`)
			.map((value) => value.toUpperCase()),
	);
	(await redis.smembers(TIERS_SET_KEY)).forEach((tier) => tier && knownTiers.add(tier.toUpperCase()));

	if (selection === `ALL`) return Array.from(knownTiers.values());
	if (knownTiers.has(selection)) return [selection];
	return [];
}

async function setTierState(tiers, isOpen) {
	const redis = getRedisClient();
	const pipeline = redis.pipeline();

	for (const tier of tiers) {
		pipeline.set(tierOpenKey(tier), isOpen ? `1` : `0`);
	}

	await pipeline.exec();

	if (!isOpen) {
		await clearTierQueues(redis, tiers);
	}
}

function buildTierStateMessage(tiers, isOpen) {
	const prefix = isOpen ? `Opened` : `Closed`;
	return `${prefix} ${tiers.length === 1 ? `tier` : `tiers`}: ${tiers.map((t) => `\`${t}\``).join(`, `)}`;
}

async function buildQueueStatusEmbed(queueConfig, matchmakerStatus = null) {
	const status = matchmakerStatus ?? { running: false };
	const startedAt = status.startedAt ? `<t:${Math.floor(status.startedAt / 1000)}:R>` : `N/A`;
	const stoppedAt = status.stoppedAt ? `<t:${Math.floor(status.stoppedAt / 1000)}:R>` : `N/A`;
	const stopReason = status.stopReason ? String(status.stopReason) : `N/A`;
	const warmupEndsAt = status.warmupEndsAt ? `<t:${Math.floor(status.warmupEndsAt / 1000)}:R>` : `N/A`;
	const scoutRoleId = String(ROLES?.LEAGUE?.SCOUT || ``);

	return new EmbedBuilder()
		.setTitle(`Queue Status`)
		.setDescription(`Live snapshot of the current queue configuration.`)
		.addFields(
			{ name: `Enabled`, value: queueConfig.enabled ? `Yes` : `No`, inline: true },
			{
				name: `Display MMR`,
				value: `${queueConfig.displayMmr}`,
				inline: true,
			},
			{ name: "", value: ``, inline: false },
			{
				name: `Queue Cancel Threshold`,
				value: `${queueConfig.cancelThreshold}%`,
				inline: true,
			},
			{ name: "", value: ``, inline: false },
			{
				name: `Relax Timeout`,
				value: `${queueConfig.relaxSeconds}s`,
				inline: true,
			},
			{
				name: `Recent Key Expiry`,
				value: `${queueConfig.recentSetTtlSeconds}s`,
				inline: true,
			},
			{
				name: `Scout Role`,
				value: scoutRoleId ? `<@&${scoutRoleId}> (${scoutRoleId})` : `*Not configured*`,
				inline: false,
			},
			{
				name: `Active Map Pool`,
				value: (queueConfig.mapPool && queueConfig.mapPool.length > 0)
					? queueConfig.mapPool.map(m => `\`${m}\``).join(`, `)
					: `Not configured`,
				inline: false,
			},
			{
				name: `New Player Game Requirement`,
				value: `${queueConfig.newPlayerGameReq} games`,
				inline: true,
			},
			{
				name: `Returning Player Game Requirement`,
				value: `${queueConfig.returningPlayerGameReq} games`,
				inline: true,
			},
			{ name: ``, value: ``, inline: false },
			{
				name: `Matchmaker Running`,
				value: status.running ? `Yes` : `No`,
				inline: true,
			},
			{
				name: `Matchmaker Interval`,
				value: status.intervalMs ? `${status.intervalMs}ms` : `N/A`,
				inline: true,
			},
			{
				name: `In-Flight Tiers`,
				value: `${status.inFlightTiers ?? 0}`,
				inline: true,
			},
			{
				name: `Warmup Active`,
				value: status.warmupActive ? `Yes` : `No`,
				inline: true,
			},
			{
				name: `Warmup Remaining`,
				value: status.warmupActive ? `${status.warmupRemainingSeconds ?? 0}s` : `N/A`,
				inline: true,
			},
			{
				name: `Warmup Ends`,
				value: warmupEndsAt,
				inline: true,
			},
			{
				name: `Last Pop`,
				value: status.lastPopAt ? `<t:${Math.floor(status.lastPopAt / 1000)}:R>` : `N/A`,
				inline: true,
			},
			{
				name: `Started`,
				value: startedAt,
				inline: true,
			},
			{
				name: `Stopped`,
				value: stoppedAt,
				inline: true,
			},
			{
				name: `Stop Reason`,
				value: stopReason,
				inline: false,
			},
		)
		.setColor(queueConfig.enabled ? 0x2ecc71 : 0xffa200)
		.setFooter({ text: `Valorant Draft Circuit - Queue Manager` });
}

async function killMatch(client, queueId, actorLabel) {
	const redis = getRedisClient();
	const queueMatchKey = matchKey(queueId);
	const matchData = await redis.hgetall(queueMatchKey);

	if (!matchData || Object.keys(matchData).length === 0) {
		return { message: `Match \`${queueId}\` was not found.` };
	}

	const parsed = parseMatchRecord(matchData);
	const players = new Set([...(parsed.teamA ?? []), ...(parsed.teamB ?? [])]);
	const pipeline = redis.pipeline();

	for (const playerId of players) {
		const key = playerKey(playerId);
		pipeline.hset(key, `status`, `idle`);
		pipeline.hdel(key, `queuePriority`, `queueJoinedAt`, `currentQueueId`);
		pipeline.del(playerRecentKey(playerId));
		pipeline.pexpire(key, 43200000);
	}

	pipeline.del(queueMatchKey, `${queueMatchKey}:cancel_votes_yes`, `${queueMatchKey}:cancel_votes_no`);
	await pipeline.exec();

	logger.log(
		`ALERT`,
		`Queue admin kill executed by ${actorLabel} for match ${queueId} — affected players: ${players.size}`,
	);

	return {
		message: `Match \`${queueId}\` was killed and players were reset.`,
		matchRecord: parsed,
	};
}

async function resetQueues(client, actorLabel) {
	const redis = getRedisClient();
	const tiers = await redis.smembers(TIERS_SET_KEY);
	const affectedUsers = new Set();
	let queuesCleared = 0;

	for (const tier of tiers) {
		if (!tier) continue;

		const listKeys = tierQueueKeys(tier, { includeCompleted: true });

		for (const key of listKeys) {
			const members = await redis.lrange(key, 0, -1);
			members.forEach((id) => {
				if (id) affectedUsers.add(id);
			});
			if (members.length > 0) queuesCleared += members.length;
			await redis.del(key);
		}
	}

	const matchKeys = await scanKeys(redis, matchKeyPattern());
	let matchesCleared = 0;

	for (const key of matchKeys) {
		const matchData = await redis.hgetall(key);
		if (!matchData || Object.keys(matchData).length === 0) {
			await redis.del(key);
			continue;
		}
		const queueId = queueIdFromMatchKey(key);
		const parsed = parseMatchRecord(matchData);

		(parsed.teamA ?? []).forEach((id) => id && affectedUsers.add(id));
		(parsed.teamB ?? []).forEach((id) => id && affectedUsers.add(id));

		try {
			await cleanupMatchChannels(client, parsed, queueId);
		} catch (error) {
			logger.log(`WARNING`, `Failed to cleanup channels for ${queueId}`, error);
		}
		await redis.del(key, `${key}:cancel_votes_yes`, `${key}:cancel_votes_no`);
		matchesCleared += 1;
	}

	if (affectedUsers.size > 0) {
		const pipeline = redis.pipeline();
		for (const userId of affectedUsers) {
			const key = playerKey(userId);
			pipeline.hset(key, `status`, `idle`);
			pipeline.hdel(key, `queuePriority`, `queueJoinedAt`, `currentQueueId`);
			pipeline.del(playerRecentKey(userId));
			pipeline.pexpire(key, 43200000);
		}
		await pipeline.exec();
	}

	logger.log(
		`ALERT`,
		`Queue admin reset executed by ${actorLabel} — queues cleared: ${queuesCleared}, matches cleared: ${matchesCleared}, players reset: ${affectedUsers.size}`,
	);

	return (
		`Queues reset complete.\n` +
		`• Cleared ${queuesCleared} queued entries across ${tiers.length} tier(s)\n` +
		`• Cleared ${matchesCleared} match record(s)\n` +
		`• Reset ${affectedUsers.size} player profile(s)`
	);
}

async function cleanupMatchChannels(client, matchRecord, queueId) {
	const descriptor = matchRecord.channels;
	if (!descriptor || !descriptor.categoryId) return;

	const guildId =
		matchRecord.guildId ||
		matchRecord.players?.find((p) => p.guildId)?.guildId ||
		null;
	if (!guildId) return;

	let guild =
		client.guilds.cache.get(guildId) ??
		(await client.guilds.fetch(guildId).catch(() => null));
	if (!guild) return;

	await deleteMatchChannels(guild, {
		categoryId: descriptor.categoryId,
		textChannelId: descriptor.textChannelId,
		voiceChannelIds: descriptor.voiceChannelIds,
		reason: `Match ${queueId} reset`,
	});
}

function parseMatchRecord(hash) {
	const teamA = parseJSONSafe(hash.teamAJSON) ?? [];
	const teamB = parseJSONSafe(hash.teamBJSON) ?? [];
	const players = parseJSONSafe(hash.playersJSON) ?? [];
	const channels = parseJSONSafe(hash.channelIdsJSON) ?? {};

	return {
		teamA,
		teamB,
		players,
		channels,
		guildId: hash.guildId || players.find((p) => p?.guildId)?.guildId,
		teamMmr: parseJSONSafe(hash.teamMmrJSON) || null,
	};
}

function parseJSONSafe(payload) {
	if (typeof payload !== `string`) return null;
	try {
		return JSON.parse(payload);
	} catch {
		return null;
	}
}

async function scanKeys(redis, pattern) {
	let cursor = `0`;
	const keys = [];

	do {
		const [nextCursor, results] = await redis.scan(cursor, `MATCH`, pattern, `COUNT`, 250);
		cursor = nextCursor;
		keys.push(...results);
	} while (cursor !== `0`);

	return keys;
}

async function clearTierQueues(redis, tiers) {
	const pipeline = redis.pipeline();
	const affectedUsers = new Set();

	for (const tier of tiers) {
		const listKeys = tierQueueKeys(tier, { includeCompleted: true });

		for (const key of listKeys) {
			const members = await redis.lrange(key, 0, -1);
			members.forEach((id) => id && affectedUsers.add(id));
			pipeline.del(key);
		}
	}

	if (affectedUsers.size === 0) {
		return;
	}

	for (const userId of affectedUsers) {
		const key = playerKey(userId);
		pipeline.hset(key, `status`, `idle`);
		pipeline.hdel(key, `queuePriority`, `queueJoinedAt`, `currentQueueId`);
		pipeline.del(playerRecentKey(userId));
	}

	await pipeline.exec();
	logger.log(
		`INFO`,
		`Queue admin close removed ${affectedUsers.size} queued player(s) after closing tiers [${tiers.join(`, `)}]`,
	);
}

module.exports = {
	handleAdminCommand,
};
module.exports.setTierState = setTierState;
