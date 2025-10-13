const { MessageFlags, PermissionFlagsBits, EmbedBuilder } = require(`discord.js`);
const { Tier } = require(`@prisma/client`);
const { getRedisClient } = require(`../../../core/redis`);
const { getQueueConfig, invalidateQueueConfigCache } = require(`../../../core/config`);
const { deleteMatchChannels } = require(`../../../core/matchChannels`);

async function handleAdminCommand(interaction, queueConfig, subcommand) {
	if (!(await hasQueueAdminPrivileges(interaction, queueConfig))) {
		return interaction.reply({
			content: `You do not have permission to manage queues.`,
			flags: MessageFlags.Ephemeral,
		});
	}

	const actorLabel = `${interaction.user.tag} (${interaction.user.id})`;

	switch (subcommand) {
		case `status`: {
			const embed = await buildQueueStatusEmbed(queueConfig);
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
			const matchId = interaction.options.getString(`match_id`, true);
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const result = await killMatch(interaction.client, matchId, actorLabel);
			await interaction.editReply({ content: result.message });

			if (result.matchRecord) {
				try {
					await cleanupMatchChannels(interaction.client, result.matchRecord, matchId);
				} catch (error) {
					logger.log(`WARNING`, `Failed to cleanup channels for ${matchId}`, error);
				}
			}

			return;
		}

		case `reset`: {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			const result = await resetQueues(interaction.client, actorLabel);
			return interaction.editReply({ content: result });
		}
	}
}

async function hasQueueAdminPrivileges(interaction, queueConfig) {
	if (interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) return true;

	const roleId = queueConfig.adminRoleId;
	if (!roleId) return false;

	return interaction.member.roles.cache.has(roleId);
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
}

function buildTierStateMessage(tiers, isOpen) {
	const prefix = isOpen ? `Opened` : `Closed`;
	return `${prefix} ${tiers.length === 1 ? `tier` : `tiers`}: ${tiers.map((t) => `\`${t}\``).join(`, `)}`;
}

async function buildQueueStatusEmbed(queueConfig) {
	return new EmbedBuilder()
		.setTitle(`Queue Status`)
		.setDescription(`Live snapshot of queue controls.`)
		.addFields(
			{ name: `Enabled`, value: queueConfig.enabled ? `Yes` : `No`, inline: true },
			{
				name: `Admin Role`,
				value: queueConfig.adminRoleId ? `<@&${queueConfig.adminRoleId}>` : `Not configured`,
				inline: true,
			},
		)
		.setColor(queueConfig.enabled ? 0x2ecc71 : 0xffa200)
		.setFooter({ text: `Queue system bootstrap — functionality pending final implementation.` });
}

async function killMatch(client, matchId, actorLabel) {
	const redis = getRedisClient();
	const matchKey = `vdc:match:${matchId}`;
	const matchData = await redis.hgetall(matchKey);

	if (!matchData || Object.keys(matchData).length === 0) {
		return { message: `Match \`${matchId}\` was not found.` };
	}

	const parsed = parseMatchRecord(matchData);
	const players = new Set([...(parsed.teamA ?? []), ...(parsed.teamB ?? [])]);
	const pipeline = redis.pipeline();

	for (const playerId of players) {
		const key = `vdc:player:${playerId}`;
		pipeline.hset(key, `status`, `idle`);
		pipeline.hdel(key, `queuePriority`, `queueJoinedAt`, `currentMatchId`);
		pipeline.del(`vdc:player:${playerId}:recent`);
	}

	pipeline.del(matchKey, `${matchKey}:cancel_votes`);
	await pipeline.exec();

	logger.log(
		`ALERT`,
		`Queue admin kill executed by ${actorLabel} for match ${matchId} — affected players: ${players.size}`,
	);

	return {
		message: `Match \`${matchId}\` was killed and players were reset.`,
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
		const matchId = key.split(`vdc:match:`)[1];
		const parsed = parseMatchRecord(matchData);

		(parsed.teamA ?? []).forEach((id) => id && affectedUsers.add(id));
		(parsed.teamB ?? []).forEach((id) => id && affectedUsers.add(id));

		try {
			await cleanupMatchChannels(client, parsed, matchId);
		} catch (error) {
			logger.log(`WARNING`, `Failed to cleanup channels for ${matchId}`, error);
		}
		await redis.del(key, `${key}:cancel_votes`);
		matchesCleared += 1;
	}

	if (affectedUsers.size > 0) {
		const pipeline = redis.pipeline();
		for (const userId of affectedUsers) {
			const key = `vdc:player:${userId}`;
			pipeline.hset(key, `status`, `idle`);
			pipeline.hdel(key, `queuePriority`, `queueJoinedAt`, `currentMatchId`);
			pipeline.del(`vdc:player:${userId}:recent`);
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

async function cleanupMatchChannels(client, matchRecord, matchId) {
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
		reason: `Match ${matchId} reset`,
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

module.exports = {
	handleAdminCommand,
};
