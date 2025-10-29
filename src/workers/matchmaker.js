const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require(`discord.js`);

const { runLua, getRedisClient } = require(`../core/redis`);
const { getQueueConfig, DEFAULT_MAP_POOL } = require(`../core/config`);
const { createMatchChannels } = require(`../core/matchChannels`);
const { generateQueueId } = require(`../core/id`);

const LUA_SCRIPT = `build_match`;
const EVENTS_KEY = `vdc:events`;

let intervalHandle;
const inFlightTiers = new Set();
let cachedMapPool = null;
let valorantMapsCache = null;
const lastTierError = new Map();

async function startMatchmaker(client, options = {}) {
	if (intervalHandle) return intervalHandle;

	const intervalMs = Math.max(2000, Number(options.intervalMs ?? 2000));
	const tick = () => runSafely(() => processAllTiers(client));

	intervalHandle = setInterval(tick, intervalMs);
	intervalHandle.unref?.();

	// Run an initial tick so we don't wait for the first interval.
	runSafely(() => processAllTiers(client));

	logger.log(`INFO`, `Queue matchmaker started (interval ${intervalMs}ms)`);
	return intervalHandle;
}

function stopMatchmaker() {
	if (intervalHandle) {
		clearInterval(intervalHandle);
		intervalHandle = undefined;
		logger.log(`INFO`, `Queue matchmaker stopped`);
	}
}

async function processAllTiers(client) {
	const config = await getQueueConfig();
	if (!config.enabled) return;

	const redis = getRedisClient();
	const tierSet = new Set(await redis.smembers(`vdc:tiers`));

	if (tierSet.size === 0) {
		const fallback = deriveTiersFromCache();
		fallback.forEach((tier) => tierSet.add(tier));
	}

	for (const tier of tierSet) {
		if (!tier || tier === `pulled`) continue;
		await attemptMatchForTier(client, tier, config);
	}
}

async function attemptMatchForTier(client, tier, config) {
	if (inFlightTiers.has(tier)) return;
	inFlightTiers.add(tier);

	try {
	const queueId = await generateQueueId(getRedisClient());
		const keys = [
			`vdc:league_state`,
			`vdc:tier:${tier}:queue:DE`,
			`vdc:tier:${tier}:queue:FA`,
			`vdc:tier:${tier}:queue:RFA`,
			`vdc:tier:${tier}:queue:SIGNED`,
			`vdc:match:${queueId}`,
			EVENTS_KEY,
			`vdc:tier:${tier}:queue:DE:completed`,
			`vdc:tier:${tier}:queue:FA:completed`,
			`vdc:tier:${tier}:queue:RFA:completed`,
			`vdc:tier:${tier}:queue:SIGNED:completed`,
		];

		const args = [
			tier,
			queueId,
			String(Date.now()),
			String(config.relaxSeconds ?? 180),
			String(config.recentSetTtlSeconds ?? config.relaxSeconds ?? 180),
			String(config.maxScanPerBucket ?? 400),
			String(config.matchSize ?? 5),
		];

		const response = await runLua(LUA_SCRIPT, { keys, args });
		const payload = parseLuaJson(response);

		if (!payload.ok) {
			const errorCode = payload.error;
			if (
				errorCode === `INSUFFICIENT_QUEUE` ||
				errorCode === `MATCH_BUILD_INCOMPLETE`
			) {
				lastTierError.set(tier, errorCode);
				return;
			}

			if (lastTierError.get(tier) !== errorCode) {
				lastTierError.set(tier, errorCode);
				logger.log(`WARNING`, `Match build failed for ${tier}`, errorCode);
			}

			return;
		}

		lastTierError.delete(tier);
		await dispatchMatch(client, payload, config);
	} catch (error) {
		logger.log(`ERROR`, `Error building match for ${tier}`, error);
	} finally {
		inFlightTiers.delete(tier);
	}
}

async function runMatchmakerOnce(client, tier) {
	if (tier && tier !== `ALL`) {
		const config = await getQueueConfig();
		await attemptMatchForTier(client, tier, config);
		return;
	}

	await processAllTiers(client);
}

async function dispatchMatch(client, payload, config) {
	let fallbackChannel = null;
	let guild = null;

	const candidateGuildId =
		payload.guildId ||
		(payload.players.find((p) => p.guildId)?.guildId);

	if (candidateGuildId) {
		guild =
			client.guilds.cache.get(candidateGuildId) ??
			(await client.guilds.fetch(candidateGuildId).catch(() => null));
	}

	if (!guild) {
		logger.log(`WARNING`, `Match ${payload.queueId} could not resolve a guild context`);
		return;
	}

	const playerIds = payload.players.map((p) => p.id);

	// collect scouts who follow any of these players
	const redis = getRedisClient();
	const scoutsSet = new Set();
	try {
		for (const p of payload.players) {
			try {
				const followers = await redis.smembers(`vdc:scouts:followers:${p.id}`);
				if (Array.isArray(followers)) {
					for (const s of followers) scoutsSet.add(s);
				}
			} catch (e) {
				// ignore redis errors for followers
			}
		}
	} catch (e) {
		// ignore
	}

	let channelDescriptor = {
		categoryId: null,
		textChannelId: fallbackChannel?.id ?? null,
		voiceChannelIds: {},
	};

	try {
		// include scouts in allowedUserIds so they can view/connect to match channels
		const allowedUserIds = playerIds.slice();
		for (const s of scoutsSet) allowedUserIds.push(s);

		channelDescriptor = await createMatchChannels(guild, {
			queueId: payload.queueId,
			tier: payload.tier,
			allowedUserIds,
			staffRoleIds: [],
			enableVoice: config.vcCreate !== false,
		});
	} catch (error) {
		logger.log(`ERROR`, `Failed to create match channels`, error);
	}

	if (!channelDescriptor.textChannelId && fallbackChannelId) {
		if (!fallbackChannel) {
			fallbackChannel = await client.channels.fetch(fallbackChannelId).catch(() => null);
		}

		if (fallbackChannel && fallbackChannel.guildId === guild.id) {
			channelDescriptor.textChannelId = fallbackChannel.id;
		} else {
			fallbackChannel = null;
		}
	}

	if (!channelDescriptor.textChannelId) {
		logger.log(`WARNING`, `Match ${payload.queueId} has no text channel target`);
		return;
	}

	const mapInfo = await getRandomMapInfo(config);
	const mmrDisplay = Boolean(config?.displayMmr);
	const embed = buildMatchEmbed(payload, mapInfo, mmrDisplay);
	const priorityEmbed = buildPriorityEmbed(payload);
	const embedData = embed.toJSON();
	const components = buildMatchComponents(payload.queueId);
	const mentionLine = playerIds.map((id) => `<@${id}>`).join(` `);

	let textChannel =
		(channelDescriptor.textChannelId &&
			(await guild.channels.fetch(channelDescriptor.textChannelId).catch(() => null))) ||
		fallbackChannel;

	if (!textChannel) {
		logger.log(`ERROR`, `No text channel available to post match ${payload.queueId}`);
		return;
	}

	try {
		const message = await textChannel.send({
			content: mentionLine,
			embeds: [embed],
			components,
		});

		await message.pin().catch(() => null);
		await updateMatchChannelsInRedis(payload.queueId, channelDescriptor);

		// Second message: Agent Lock Order only
		await textChannel.send({
			embeds: [priorityEmbed],
		});

		// Notify players directly via DM and scouts as well
		await notifyPlayersDirectly(client, payload, embedData, channelDescriptor.textChannelId, guild, Array.from(scoutsSet));

		// Send match embed to scout channel if configured
		if (config.scoutChannelId) {
			let scoutChannel = null;
			try {
				scoutChannel = await guild.channels.fetch(config.scoutChannelId).catch(() => null);
			} catch (error) {
				// ignore
			}

			if (scoutChannel) {
				await scoutChannel.send({
					content: `A new match has been started in <#${channelDescriptor.textChannelId}>`,
					embeds: [embed],
				});
			}
		}
	} catch (error) {
		logger.log(`ERROR`, `Failed to send match embed`, error);
	}
}


function buildMatchEmbed(payload, mapInfo, showMmrTotals) {
	const teamA = payload.teamA.map((id) => `<@${id}>`).join(`\n`);
	const teamB = payload.teamB.map((id) => `<@${id}>`).join(`\n`);
 const teamMmr = payload.teamMmr || {};
 const hasMmr =
 	showMmrTotals &&
 	typeof teamMmr.teamA === `number` &&
 	typeof teamMmr.teamB === `number`;
 const sumA = hasMmr ? Math.round(teamMmr.teamA) : 0;
 const sumB = hasMmr ? Math.round(teamMmr.teamB) : 0;
 const diff = hasMmr ? Math.abs(sumA - sumB) : 0;
 const mmrFieldValue = hasMmr
 	? `Team A: **${sumB}**\nTeam B: **${sumA}**\nΔ: **${diff}**`
 	: null;
	// TODO: Swap teamA and teamB in display so attackers are on the right side

	const embed = new EmbedBuilder()
		.setTitle(`MATCH FOUND!`)
		.setAuthor({ name: `VDC Queue Manager` })
		.setDescription(
			`**Tier**: ${payload.tier}\n` +
				`**Queue ID**: ${payload.queueId}\n` +
				`**Map**: ${mapInfo.name}\n` + 
				`**Relaxed**: ${payload.relaxed ? `Yes` : `No`}`,
		)
		.addFields(
			{ name: `Attackers Roster`, value: teamB || `TBD`, inline: true },
			{ name: `Defenders Roster`, value: teamA || `TBD`, inline: true }, // TODO: Fix this later, it shows teamB on the left vs teamA on the right
		)
		.setColor(0xde3845);

	if (mmrFieldValue) {
		embed.addFields({ name: `MMR Totals`, value: mmrFieldValue, inline: false });
	}

	embed.setFooter({ text: `If you'd still like to change the map, feel free to do so!` });

	if (mapInfo.image) {
		embed.setImage(mapInfo.image);
	}

	return embed;
}

function buildPriorityEmbed(payload) {
	const players = Array.isArray(payload.players) ? payload.players.slice() : [];
	if (players.length === 0) {
		return new EmbedBuilder().setTitle(`Agent Lock Order`).setDescription(`No players found`).setColor(0x5865F2);
	}

	const order = ["DE", "FA", "RFA", "SIGNED"];
	const bucketIndex = (b) => {
		const i = order.indexOf(String(b || "").toUpperCase());
		return i === -1 ? 999 : i;
	};

	// Compute weight: primaries first, then completed of same bucket
	players.sort((a, b) => {
		const aCompleted = !!a.completed;
		const bCompleted = !!b.completed;
		const aw = bucketIndex(a.bucket) + (aCompleted ? 3 : 0);
		const bw = bucketIndex(b.bucket) + (bCompleted ? 3 : 0);
		if (aw !== bw) return aw - bw;
		// Tiebreaker by earlier join time (earlier gets priority)
		const aj = typeof a.joinedAt === "number" ? a.joinedAt : 0;
		const bj = typeof b.joinedAt === "number" ? b.joinedAt : 0;
		if (aj !== bj) return aj - bj;
		// Final tiebreaker by id for determinism
		return String(a.id).localeCompare(String(b.id));
	});

	const lines = players.map((p) => {
		const mention = `<@${p.id}>`;
		const bucket = String(p.bucket || "?");
		const isCompleted = p.completed ? `, Requirements Fulfilled` : ``;
		const groupIdx = bucketIndex(p.bucket) + (p.completed ? 3 : 0);
		const displayNumber = groupIdx === 999 ? "?" : String(groupIdx + 1);
		// Insert a zero-width space after the period to avoid Discord's auto-numbered list formatting
		const dot = ".\u200B ";
		return `${displayNumber}${dot}${mention} — ${bucket}${isCompleted}`;
	});

	const embed = new EmbedBuilder()
		.setTitle(`Agent Lock Order`)
		.setDescription(lines.join(`\n`))
		.setFooter({ text: `The order listed is the order that should be followed when locking in. If you see anyone ignoring the order, please open a ticket.` });

	return embed;
}


function buildMatchComponents(queueId) {
	const joinLobby = new ButtonBuilder()
		.setCustomId(`queueManager_joinLobby-${queueId}`)
		.setLabel(`Join Lobby VC`)
		.setStyle(ButtonStyle.Secondary);

	const joinAttackers = new ButtonBuilder()
		.setCustomId(`queueManager_joinAttackers-${queueId}`)
		.setLabel(`Join Attackers`)
		.setStyle(ButtonStyle.Danger);

	const joinDefenders = new ButtonBuilder()
		.setCustomId(`queueManager_joinDefenders-${queueId}`)
		.setLabel(`Join Defenders`)
		.setStyle(ButtonStyle.Success);

	const submitResult = new ButtonBuilder()
		.setCustomId(`queueManager_submit-${queueId}`)
		.setLabel(`Submit Match Link`)
		.setStyle(ButtonStyle.Primary);

	return [
		new ActionRowBuilder({
			components: [joinLobby, joinAttackers, joinDefenders, submitResult],
		}),
	];
}

async function notifyPlayersDirectly(client, payload, embedData, textChannelId, guild, extraScoutIds = []) {
	const channelLink = `https://discord.com/channels/${guild.id}/${textChannelId}`;
	const playerContent = `Match Found, Agent!  Good luck out there.  Match chat: ${channelLink}`;

	// Notify players
	for (const player of payload.players) {
		const playerId = player.id;
		try {
			const user = await client.users.fetch(playerId);
			await user.send({ content: playerContent, embeds: [embedData] });
		} catch (error) {
			logger.log(`WARNING`, `Failed to DM player ${playerId} about match ${payload.queueId}`, error);
		}
	}

	// Notify scouts — use provided extraScoutIds if available; otherwise read from Redis
	let scoutIds = Array.isArray(extraScoutIds) && extraScoutIds.length ? extraScoutIds.slice() : null;
	const redis = getRedisClient();
	if (!scoutIds) {
		try {
			const scoutSet = new Set();
			for (const player of payload.players) {
				const followers = await redis.smembers(`vdc:scouts:followers:${player.id}`).catch(() => []);
				for (const f of followers || []) scoutSet.add(f);
			}
			scoutIds = Array.from(scoutSet);
		} catch (error) {
			logger.log(`WARNING`, `Failed to read scout followers from redis for match ${payload.queueId}`, error);
			scoutIds = [];
		}
	}

	if (!Array.isArray(scoutIds) || scoutIds.length === 0) return;

	const uniqueScouts = [...new Set(scoutIds)];
	const scoutContent = `A player you've followed has found a match! Match chat: ${channelLink}`;
	for (const scoutId of uniqueScouts) {
		try {
			const user = await client.users.fetch(scoutId);
			await user.send({ content: scoutContent, embeds: [embedData] });
		} catch (error) {
			logger.log(`WARNING`, `Failed to DM scout ${scoutId} about match ${payload.queueId}`, error);
		}
	}
}

async function updateMatchChannelsInRedis(queueId, descriptor) {
	const redis = getRedisClient();
	await redis.hset(`vdc:match:${queueId}`, `channelIdsJSON`, JSON.stringify(descriptor));
	await redis.hset(`vdc:match:${queueId}`, `status`, `active`);
}

function deriveTiersFromCache() {
	const tierLines = global.mmrTierLinesCache ?? {};
	return Object.keys(tierLines).filter((tier) => tier && tier !== `pulled`);
}

function parseLuaJson(response) {
	if (response == null) return {};
	if (typeof response === `string`) {
		try {
			return JSON.parse(response);
		} catch (error) {
			logger.log(`ERROR`, `Failed to parse Lua response`, error);
			return {};
		}
	}
	return response;
}

function runSafely(fn) {
	Promise.resolve()
		.then(fn)
		.catch((error) => logger.log(`ERROR`, `Matchmaker tick failure`, error));
}


async function getRandomMapInfo(config) {
	const pool = await resolveMapPool(config);
	if (!pool.length) {
		return { name: `TBD`, image: null };
	}

	const choice = pool[Math.floor(Math.random() * pool.length)];
	if (choice.image) return choice;

	return { name: choice.name, image: choice.image ?? null };
}

async function resolveMapPool(config) {
	if (cachedMapPool && cachedMapPool.timestamp > Date.now() - 5 * 60 * 1000) {
		return cachedMapPool.pool;
	}

	let mapNames = config.mapPool;
	if (!Array.isArray(mapNames) || mapNames.length === 0) {
		mapNames = DEFAULT_MAP_POOL;
	}

	const maps = await loadValorantMaps();
	const pool = mapNames
		.map((name) => {
			const match = maps.find((m) => m.displayName.toUpperCase() === name.toUpperCase());
			if (!match) {
				return { name };
			}

			return {
				name: match.displayName,
				image: match.splash,
			};
		})
		.filter(Boolean);

	cachedMapPool = {
		pool,
		timestamp: Date.now(),
	};
	return pool;
}

async function loadValorantMaps() {
	if (valorantMapsCache && valorantMapsCache.timestamp > Date.now() - 6 * 60 * 60 * 1000) {
		return valorantMapsCache.data;
	}

	try {
		const response = await fetch(`https://valorant-api.com/v1/maps`);
		if (!response.ok) throw new Error(`MAP_FETCH_FAILED`);
		const body = await response.json();
		const data = Array.isArray(body?.data) ? body.data : [];
		valorantMapsCache = { data, timestamp: Date.now() };
		return data;
	} catch (error) {
		logger.log(`WARNING`, `Unable to load map data`, error);
		valorantMapsCache = { data: [], timestamp: Date.now() };
		return [];
	}
}

module.exports = {
	startMatchmaker,
	stopMatchmaker,
	runMatchmakerOnce,
};
