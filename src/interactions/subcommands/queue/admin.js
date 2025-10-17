const { MessageFlags, PermissionFlagsBits, EmbedBuilder } = require(`discord.js`);
const { Tier } = require(`@prisma/client`);
const { getRedisClient } = require(`../../../core/redis`);
const { getQueueConfig, invalidateQueueConfigCache } = require(`../../../core/config`);
const { deleteMatchChannels } = require(`../../../core/matchChannels`);
const { buildCombineCountCache } = require(`../../../../cache/cache`);

async function handleAdminCommand(interaction, queueConfig, subcommand) {
	// Permission is enforced by Discord via command registration (ManageGuild or Administrator).
	// Rely on Discord to hide this command for unauthorized users.

	const actorLabel = `${interaction.user.tag} (${interaction.user.id})`;

	switch (subcommand) {
			case `status`: {
				const embed = await buildQueueStatusEmbed(queueConfig, interaction);
				return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
			}

		case `open`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const tierSelection = interaction.options.getString(`tier`, true).toUpperCase();
			const tiers = await resolveTiers(tierSelection);
			if (tiers.length === 0) {
				return interaction.editReply({ content: `No tiers matched \">${tierSelection}\".` });
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
				return interaction.editReply({ content: `No tiers matched \">${tierSelection}\".` });
			}

			await setTierState(tiers, false);
			logger.log(`INFO`, `Queue admin close executed by ${actorLabel} for tiers [${tiers.join(`, `)}]`);
			return interaction.editReply({ content: buildTierStateMessage(tiers, false) });
		}

		case `reload-config`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			logger.log(`INFO`, `Queue admin config reload executed by ${actorLabel}`);
			await invalidateQueueConfigCache();
			await getQueueConfig({ forceRefresh: true });
			await buildCombineCountCache();
			return interaction.editReply({
				content: `Queue configuration cache reloaded.`,
			});
		}

		case `build`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const tierSelection = interaction.options.getString(`tier`, true).toUpperCase();
			const { runMatchmakerOnce } = require(`../../../workers/matchmaker`);
			await runMatchmakerOnce(interaction.client, tierSelection);
			logger.log(`INFO`, `Queue admin build triggered by ${actorLabel} for ${tierSelection}`);
			return interaction.editReply({
				content:
					tierSelection === `ALL`
						? `Triggered the matchmaker for all tiers.`
						: `Triggered the matchmaker for ${tierSelection}.`,
			});
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

			const validBuckets = new Set([`DE`, `FA_RFA`, `SIGNED`]);
			if (!validBuckets.has(bucket)) {
				return interaction.editReply({ content: `Invalid bucket type: ${bucket}` });
			}

			// Generate dummy IDs and push them to the queue list. Use a distinct prefix to avoid colliding
			// with real user IDs. Each dummy will have a player hash similar to real players.
			const created = [];
			for (let i = 0; i < count; i++) {
				// ensure reasonably unique id
				const dummyId = `dummy_${Date.now().toString(36)}_${Math.floor(Math.random() * 100000)}_${i}`;
				const playerKey = `vdc:player:${dummyId}`;
				const nowMs = Date.now().toString();
				// Set a simple player hash
				const hashPayload = {
					status: `queued`,
					tier: tierSelection,
					queueJoinedAt: nowMs,
					mmr: `1000`,
					guildId: ``,
				};
				if (typeof games === 'number') hashPayload.gameCount = String(games);
				await redis.hset(playerKey, hashPayload);
				// set TTL so these expire after 5 minutes (short-lived test players)
				await redis.pexpire(playerKey, 300000);
				// Push to the selected queue list (primary or completed sibling depending on flag)
				const queueKey = completedFlag
					? `vdc:tier:${tierSelection}:queue:${bucket}:completed`
					: `vdc:tier:${tierSelection}:queue:${bucket}`;
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
			.filter((value) => typeof value === `string`)
			.map((value) => value.toUpperCase()),
	);
	(await redis.smembers(`vdc:tiers`)).forEach((tier) => tier && knownTiers.add(tier.toUpperCase()));

	if (selection === `ALL`) return Array.from(knownTiers.values());
	if (knownTiers.has(selection)) return [selection];
	return [];
}

async function setTierState(tiers, isOpen) {
	const redis = getRedisClient();
	const pipeline = redis.pipeline();

	for (const tier of tiers) {
		pipeline.set(`vdc:tier:${tier}:open`, isOpen ? `1` : `0`);
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

async function buildQueueStatusEmbed(queueConfig, interaction) {
	let scoutRoleDisplay = `Not configured`;

	if (queueConfig.scoutRoleId) {
		const id = String(queueConfig.scoutRoleId);
		// If interaction is provided and in a guild, try to resolve the role object
		try {
			const guild = interaction?.guild ?? null;
			if (guild) {
				const role = guild.roles.cache.get(id) ?? (await guild.roles.fetch(id).catch(() => null));
				if (role) {
					scoutRoleDisplay = `<@&${id}> ${role.name} (${id})`;
				} else {
					scoutRoleDisplay = `${id}`;
				}
			} else {
				scoutRoleDisplay = `${id}`;
			}
		} catch (err) {
			scoutRoleDisplay = `${id}`;
		}
	}

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
				name: `Channel Management Active`,
				value: `${queueConfig.vcCreate ? `Yes` : `No`}`,
				inline: true,
			},
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
				value: `<@&${queueConfig.scoutRoleId}> (${queueConfig.scoutRoleId})` + (queueConfig.scoutRoleId ? `` : `*Not configured*`),
				inline: false,
			},
			{ name: `Active Map Pool`,
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
			}
		)
		.setColor(queueConfig.enabled ? 0x2ecc71 : 0xffa200)
		.setFooter({ text: `Valorant Draft Circuit - Queue Manager` });
}

async function killMatch(client, queueId, actorLabel) {
	const redis = getRedisClient();
	const matchKey = `vdc:match:${queueId}`;
	const matchData = await redis.hgetall(matchKey);

	if (!matchData || Object.keys(matchData).length === 0) {
		return { message: `Match \`${queueId}\` was not found.` };
	}

	const parsed = parseMatchRecord(matchData);
	const players = new Set([...(parsed.teamA ?? []), ...(parsed.teamB ?? [])]);
	const pipeline = redis.pipeline();

	for (const playerId of players) {
		const key = `vdc:player:${playerId}`;
		pipeline.hset(key, `status`, `idle`);
		pipeline.hdel(key, `queuePriority`, `queueJoinedAt`, `currentQueueId`);
		pipeline.del(`vdc:player:${playerId}:recent`);
		pipeline.pexpire(key, 43200000);
	}

	pipeline.del(matchKey, `${matchKey}:cancel_votes_yes`, `${matchKey}:cancel_votes_no`);
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
	const tiers = await redis.smembers(`vdc:tiers`);
	const affectedUsers = new Set();
	let queuesCleared = 0;

	for (const tier of tiers) {
		if (!tier) continue;

		const listKeys = [
			`vdc:tier:${tier}:queue:DE`,
			`vdc:tier:${tier}:queue:FA_RFA`,
			`vdc:tier:${tier}:queue:SIGNED`,
		];

		for (const key of listKeys) {
			const members = await redis.lrange(key, 0, -1);
			members.forEach((id) => {
				if (id) affectedUsers.add(id);
			});
			if (members.length > 0) queuesCleared += members.length;
			await redis.del(key);
		}
	}

	const matchKeys = await scanKeys(redis, `vdc:match:*`);
	let matchesCleared = 0;

	for (const key of matchKeys) {
		const matchData = await redis.hgetall(key);
		if (!matchData || Object.keys(matchData).length === 0) {
			await redis.del(key);
			continue;
		}
		const queueId = key.split(`vdc:match:`)[1];
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
			const key = `vdc:player:${userId}`;
			pipeline.hset(key, `status`, `idle`);
			pipeline.hdel(key, `queuePriority`, `queueJoinedAt`, `currentQueueId`);
			pipeline.del(`vdc:player:${userId}:recent`);
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
			const listKeys = [
				`vdc:tier:${tier}:queue:DE`,
				`vdc:tier:${tier}:queue:FA_RFA`,
				`vdc:tier:${tier}:queue:SIGNED`,
				// completed/low-priority siblings
				`vdc:tier:${tier}:queue:DE:completed`,
				`vdc:tier:${tier}:queue:FA_RFA:completed`,
				`vdc:tier:${tier}:queue:SIGNED:completed`,
			];

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
		const key = `vdc:player:${userId}`;
		pipeline.hset(key, `status`, `idle`);
		pipeline.hdel(key, `queuePriority`, `queueJoinedAt`, `currentQueueId`);
		pipeline.del(`vdc:player:${userId}:recent`);
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
