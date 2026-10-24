const { MessageFlags, EmbedBuilder } = require(`discord.js`);
const { Tier } = require(`@prisma/client`);
const { Player } = require(`../../../../prisma`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { ROLES } = require(`../../../../utils/enums/roles`);
const { CHANNELS } = require(`../../../../utils/enums/channels`);
const { getRedisClient, runLua } = require(`../../../core/redis`);
const { getQueueConfig, invalidateQueueConfigCache } = require(`../../../core/queue/queueconfig`);
const { deleteMatchChannels } = require(`../../../core/queue/matchChannels`);
const { getQueueMatchContext, finalizeQueueCombineSubmission, releaseQueueMatch, deleteQueueMatchChannels } = require(`../../../core/queue/matchLifecycle`);
const {
	LEAGUE_STATE_KEY,
	EVENTS_STREAM_KEY,
	TIERS_SET_KEY,
	tierOpenKey,
	tierQueueKey,
	tierQueueKeys,
	playerKey,
	playerRecentKey,
	playerSuspendedKey,
	matchKey,
	matchKeyPattern,
	queueIdFromMatchKey,
} = require(`../../../helpers/queue/queueKeys`);
const { getCurrentChannelCount } = require(`../../../workers/matchmaker/capacity`);
const { deriveTierFromMmr } = require(`../../../helpers/queue/queueState`);
const { buildMMRCache } = require(`../debug/updateMMR`);

const TRACKER_MATCH_URL = `https://tracker.gg/valorant/match/`;
const validMatchRegex = /^https:\/\/tracker.gg\/valorant\/match\/([a-z0-9]{8})-([a-z0-9]{4}-){3}([a-z0-9]{12})$/;

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

			await setTierState(tiers, true, interaction.client);
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

			await setTierState(tiers, false, interaction.client);
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

		case `complete-match`: {
			const queueId = interaction.options.getString(`queue_id`, true);
			const url = interaction.options.getString(`url`);
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const result = await completeMatch(interaction, queueId, url, actorLabel);
			try {
				return await interaction.editReply({ content: result.message });
			} finally {
				if (result.queueContext) await deleteQueueMatchChannels(interaction.guild, result.queueContext);
			}
		}

		case `suspend`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const target = interaction.options.getUser(`player`, true);
			const hours = interaction.options.getInteger(`hours`);
			const reason = interaction.options.getString(`reason`);
			const result = await suspendPlayer(target, { hours, reason }, interaction.user.id, actorLabel);
			return interaction.editReply({ content: result });
		}

		case `unsuspend`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const target = interaction.options.getUser(`player`, true);
			const removed = await getRedisClient().del(playerSuspendedKey(target.id));
			if (!removed) {
				return interaction.editReply({ content: `<@${target.id}> is not suspended from the queue.` });
			}

			logger.log(`ALERT`, `Queue admin unsuspend executed by ${actorLabel} for ${target.tag} (${target.id})`);
			return interaction.editReply({ content: `Lifted the queue suspension for <@${target.id}>.` });
		}

		case `update-mmr`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const target = interaction.options.getUser(`player`, true);
			const newMmr = interaction.options.getNumber(`mmr`, true);
			const result = await updatePlayerMmr(target, newMmr, queueConfig, actorLabel);
			return interaction.editReply({ content: result });
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

async function setTierState(tiers, isOpen, client = null) {
	const redis = getRedisClient();
	const pipeline = redis.pipeline();

	for (const tier of tiers) {
		pipeline.set(tierOpenKey(tier), isOpen ? `1` : `0`);
	}

	await pipeline.exec();
	await manageWaitingRoomChannels(client, tiers, isOpen);

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

	const redis = getRedisClient();
	const allTiers = await redis.smembers(TIERS_SET_KEY);
	const openTiers = [];
	for (const tier of allTiers) {
		if (!tier) continue;
		const val = await redis.get(tierOpenKey(tier));
		if (val === `1`) openTiers.push(tier);
	}
	const openQueuesValue = openTiers.length > 0
		? openTiers.map((t) => `\`${t}\``).join(`, `)
		: `No queues are currently open.`;

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
			{
				name: `Channel Count`,
				value: `${await getCurrentChannelCount(client)}/${queueConfig.channelStopThreshold}`,
				inline: true,
			},
			{ name: `Currently Open Queues`, value: openQueuesValue, inline: false },
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
	// only players still bound to this match are reset, so killing an old match can't pull
	// anyone out of the queue or a newer match
	const result = await releaseQueueMatch(queueId, `cancel`);
	if (!result.ok) {
		return { message: `Match \`${queueId}\` was not found.` };
	}

	logger.log(
		`ALERT`,
		`Queue admin kill executed by ${actorLabel} for match ${queueId} — players reset: ${result.released.length}, already moved on: ${result.skipped.length}`,
	);

	const movedOn = result.skipped.length ? ` ${result.skipped.length} player(s) had already moved on and were left alone.` : ``;
	return {
		message: `Match \`${queueId}\` was killed and ${result.released.length} player(s) were reset.${movedOn}`,
		matchRecord: parsed,
	};
}

/** Runs the queue cleanup /submit normally does, for matches whose submit didn't trigger it. */
async function completeMatch(interaction, queueId, url, actorLabel) {
	if (url && !validMatchRegex.test(url)) {
		return { message: `That doesn't look like a valid tracker.gg match URL. Nothing was changed.` };
	}

	const queueContext = await getQueueMatchContext(queueId);
	if (!queueContext) {
		return { message: `Match \`${queueId}\` was not found.` };
	}
	// finalize increments every player's gameCount, so running it twice would double count
	if (queueContext.matchData.status === `completed`) {
		return { message: `Match \`${queueId}\` is already completed. Nothing was changed.` };
	}

	const completed = await finalizeQueueCombineSubmission({
		userId: interaction.user.id,
		queueContext,
		gameID: url ? url.replace(TRACKER_MATCH_URL, ``) : ``,
		url,
	});
	if (!completed) {
		return { message: `Failed to complete match \`${queueId}\`. Check the logs for details.` };
	}

	logger.log(
		`WARNING`,
		`Queue admin complete-match executed by ${actorLabel} for match ${queueId} — players unlocked: ${queueContext.players.length}`,
	);

	return {
		message: `Match \`${queueId}\` was marked completed. ${queueContext.players.length} player(s) were unlocked and credited with a game, and the match channels were removed.`,
		queueContext,
	};
}

async function suspendPlayer(target, { hours, reason }, actorId, actorLabel) {
	const redis = getRedisClient();
	const now = Date.now();
	const suspensionKey = playerSuspendedKey(target.id);
	const payload = JSON.stringify({ reason: reason ?? null, suspendedBy: actorId, suspendedAt: now });

	// Set the suspension before dequeueing so a join racing this command is rejected by join.lua.
	if (hours) await redis.set(suspensionKey, payload, `EX`, hours * 3600);
	else await redis.set(suspensionKey, payload);

	// leave.lua atomically pulls a queued player out of every list, and refuses without changes
	// when they are in a match, which lets that match play out.
	const leave = parseJSONSafe(await runLua(`leave`, {
		keys: [playerKey(target.id), EVENTS_STREAM_KEY, LEAGUE_STATE_KEY, TIERS_SET_KEY],
		args: [target.id, String(now)],
	})) ?? {};

	const duration = hours
		? `for ${hours} hour(s), ending <t:${Math.floor((now + hours * 3600000) / 1000)}:R>`
		: `until they are unsuspended`;
	const lines = [`Suspended <@${target.id}> from the queue ${duration}.`];
	if (reason) lines.push(`• Reason: ${reason}`);
	if (leave.ok) lines.push(`• Removed them from the ${leave.tier} queue.`);
	if (leave.error === `IN_MATCH`) {
		lines.push(`• They're in match \`${leave.details?.queueId ?? `unknown`}\`, which will continue. They can't queue again after it ends.`);
	}

	logger.log(
		`ALERT`,
		`Queue admin suspend executed by ${actorLabel} for ${target.tag} (${target.id}) ${hours ? `for ${hours}h` : `indefinitely`}${reason ? ` — reason: ${reason}` : ``}`,
	);

	return lines.join(`\n`);
}

/**
 * Change a player's MMR mid-combines: the DB column queue joins read (via the bot's MMR cache), plus
 * their spot if they're queued. A match they're in keeps its tier; numbers never checks MMR on submit.
 */
async function updatePlayerMmr(target, newMmr, queueConfig, actorLabel) {
	const newTier = deriveTierFromMmr(newMmr);
	if (!newTier) {
		return `An MMR of \`${newMmr}\` doesn't fall in any tier's range, so nothing was changed. Check the number and try again.`;
	}

	const player = await Player.getBy({ discordID: target.id });
	const mmrEntry = player?.PrimaryRiotAccount?.MMR;
	if (!mmrEntry) {
		return `<@${target.id}> has no MMR record (no player profile or primary Riot account), so nothing was changed.`;
	}

	const oldMmr = mmrEntry.mmrEffective;
	await prisma.mMR.update({ where: { id: mmrEntry.id }, data: { mmrEffective: newMmr } });

	// joins read MMR from this cache; the file reload takes a few seconds, so patch the loaded copy too
	await buildMMRCache();
	const cached = global.mmrCache?.find((entry) => entry.discordID === target.id);
	if (cached) cached.mmr = newMmr;

	const outcome = parseJSONSafe(await runLua(`update_queue_mmr`, {
		keys: [playerKey(target.id), tierOpenKey(newTier), TIERS_SET_KEY],
		args: [target.id, newTier, String(newMmr), String(Date.now()), queueConfig?.perTierFlags?.[newTier] === false ? `closed` : ``],
	})) ?? {};

	const oldTier = oldMmr == null ? null : deriveTierFromMmr(Number(oldMmr));
	const lines = [`Updated <@${target.id}>'s MMR: \`${oldMmr ?? `none`}\` → \`${newMmr}\` (${oldTier ?? `?`} → ${newTier}).`];
	switch (outcome.state) {
		case `in_match`:
			lines.push(`• They're in match \`${outcome.queueId}\`. It keeps its tier and can be submitted normally. The new MMR applies from their next \`/queue join\`.`);
			break;
		case `same_tier`:
			lines.push(`• They're queued in ${newTier} and kept their spot.`);
			break;
		case `moved`:
			lines.push(`• Moved from the ${outcome.from} queue to the back of the ${outcome.to} queue.`);
			break;
		case `removed_tier_closed`:
			lines.push(`• Removed from the ${outcome.from} queue because the ${outcome.to} queue is closed.`);
			break;
		default:
			lines.push(`• They're not queued. The new MMR applies from their next \`/queue join\`.`);
	}

	logger.log(`INFO`, `Queue admin update-mmr executed by ${actorLabel} for ${target.tag} (${target.id}): ${oldMmr} -> ${newMmr} (${outcome.state ?? `unknown`})`);
	return lines.join(`\n`);
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

	// the cancel-vote keys share the vdc:match: prefix; HGETALL on them threw WRONGTYPE mid-reset
	const matchKeys = await scanKeys(redis, matchKeyPattern(), `hash`);
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

async function scanKeys(redis, pattern, type = null) {
	let cursor = `0`;
	const keys = [];
	const typeFilter = type ? [`TYPE`, type] : [];

	do {
		const [nextCursor, results] = await redis.scan(cursor, `MATCH`, pattern, ...typeFilter, `COUNT`, 250);
		cursor = nextCursor;
		keys.push(...results);
	} while (cursor !== `0`);

	return keys;
}

async function clearTierQueues(redis, tiers) {
	const affectedUsers = new Set();
	const listKeys = tiers.flatMap((tier) => tierQueueKeys(tier, { includeCompleted: true }));

	for (const key of listKeys) {
		const members = await redis.lrange(key, 0, -1);
		members.forEach((id) => id && affectedUsers.add(id));
	}

	if (affectedUsers.size === 0) {
		return;
	}

	// The matchmaker keeps popping closed tiers until their lists are empty, so someone read above
	// may be in a match by now. leave.lua only dequeues players who are still queued; blindly
	// setting everyone idle used to unbind those players from the match they were just put in.
	const now = String(Date.now());
	const closing = new Set(tiers.map(String));
	let dequeued = 0;
	for (const userId of affectedUsers) {
		// a leftover entry for someone queued in another tier must not dequeue them there
		const queuedTier = await redis.hget(playerKey(userId), `tier`);
		if (queuedTier && !closing.has(queuedTier)) continue;
		const leave = await runLua(`leave`, {
			keys: [playerKey(userId), EVENTS_STREAM_KEY, LEAGUE_STATE_KEY, TIERS_SET_KEY],
			args: [userId, now],
		}).catch((error) => logger.log(`WARNING`, `Failed to dequeue ${userId} while closing tiers`, error));
		if (parseJSONSafe(leave)?.ok) dequeued += 1;
	}

	// join refuses closed tiers, so anything still listed is a leftover entry
	const pipeline = redis.pipeline();
	pipeline.del(...listKeys);
	for (const userId of affectedUsers) pipeline.del(playerRecentKey(userId));
	await pipeline.exec();
	logger.log(
		`INFO`,
		`Queue admin close removed ${dequeued} queued player(s) after closing tiers [${tiers.join(`, `)}]`,
	);
}

async function manageWaitingRoomChannels(client, tiers, isOpen) {
	if (!client || !Array.isArray(tiers) || tiers.length === 0) return;

	const waitingRooms = CHANNELS?.VC?.COMBINES?.WAITING_ROOM ?? {};
	const leagueRoleId = ROLES?.LEAGUE?.LEAGUE ? String(ROLES.LEAGUE.LEAGUE) : null;
	if (!leagueRoleId) {
		logger.log(`WARNING`, `Queue admin could not update waiting rooms because league role is not configured`);
		return;
	}

	for (const tier of tiers) {
		const tierKey = String(tier || ``).toUpperCase();
		const channelId = waitingRooms[tierKey] ? String(waitingRooms[tierKey]) : null;
		if (!channelId) continue;

		const channel =
			client.channels.cache.get(channelId) ??
			(await client.channels.fetch(channelId).catch(() => null));

		if (!channel || !channel.guild || !channel.permissionOverwrites) {
			logger.log(`WARNING`, `Queue admin could not resolve waiting room channel for ${tierKey} (${channelId})`);
			continue;
		}

		try {
			await channel.permissionOverwrites.edit(leagueRoleId, { ViewChannel: isOpen });
			// Too much noise in logs for this.  Kept for debugging.
			// logger.log(`INFO`, `Queue admin ${isOpen ? `opened` : `closed`} waiting room ${tierKey} (${channelId})`);
		} catch (error) {
			logger.log(`WARNING`, `Queue admin failed to update waiting room ${tierKey} (${channelId})`, error);
		}
	}
}

module.exports = {
	handleAdminCommand,
};
module.exports.setTierState = setTierState;
