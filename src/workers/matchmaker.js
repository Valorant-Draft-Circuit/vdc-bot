const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
} = require(`discord.js`);

const { runLua, getRedisClient } = require(`../core/redis`);
const { getQueueConfig, DEFAULT_MAP_POOL } = require(`../core/config`);
const { createMatchChannels } = require(`../core/matchChannels`);
const { isMmrDisplayEnabled } = require(`../core/mmrDisplay`);
const { generateMatchId } = require(`../core/id`);

const LUA_SCRIPT = `build_match`;
const EVENTS_KEY = `vdc:events`;

let intervalHandle;
const inFlightTiers = new Set();
let cachedMapPool = null;
let valorantMapsCache = null;
const lastTierError = new Map();

function log(level, message, error) {
	if (global.logger && typeof global.logger.log === `function`) {
		global.logger.log(level, message, error);
	} else if (error) {
		console.log(`[${level}] ${message} :: ${error.message || error}`);
	} else {
		console.log(`[${level}] ${message}`);
	}
}

async function startMatchmaker(client, options = {}) {
	if (intervalHandle) return intervalHandle;

	const intervalMs = Math.max(2000, Number(options.intervalMs ?? 2000));
	const tick = () => runSafely(() => processAllTiers(client));

	intervalHandle = setInterval(tick, intervalMs);
	intervalHandle.unref?.();

	// Run an initial tick so we don't wait for the first interval.
	runSafely(() => processAllTiers(client));

	log(`INFO`, `Queue matchmaker started (interval ${intervalMs}ms)`);
	return intervalHandle;
}

function stopMatchmaker() {
	if (intervalHandle) {
		clearInterval(intervalHandle);
		intervalHandle = undefined;
		log(`INFO`, `Queue matchmaker stopped`);
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
        const matchId = await generateMatchId(getRedisClient());
        const keys = [
            `vdc:league_state`,
            `vdc:tier:${tier}:queue:DE`,
            `vdc:tier:${tier}:queue:FA_RFA`,
            `vdc:tier:${tier}:queue:SIGNED`,
            `vdc:match:${matchId}`,
            EVENTS_KEY,
        ];

		const args = [
			tier,
			matchId,
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
				log(`WARNING`, `Match build failed for ${tier}`, errorCode);
			}

			return;
		}

		lastTierError.delete(tier);
		await dispatchMatch(client, payload, config);
	} catch (error) {
		log(`ERROR`, `Error building match for ${tier}`, error);
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
	const fallbackChannelId = config.announcementsChannelId;
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

	if (!guild && fallbackChannelId) {
		fallbackChannel =
			client.channels.cache.get(fallbackChannelId) ??
			(await client.channels.fetch(fallbackChannelId).catch(() => null));
		guild = fallbackChannel?.guild ?? guild;
	}

	if (!guild) {
		log(`WARNING`, `Match ${payload.matchId} could not resolve a guild context`);
		return;
	}

	const playerIds = payload.players.map((p) => p.id);

	let channelDescriptor = {
		categoryId: null,
		textChannelId: fallbackChannel?.id ?? null,
		voiceChannelIds: {},
	};

	try {
		channelDescriptor = await createMatchChannels(guild, {
			matchId: payload.matchId,
			tier: payload.tier,
			allowedUserIds: playerIds,
			staffRoleIds: filterStaffRoles(config.staffRoleId, guild),
			enableVoice: config.vcCreate !== false,
		});
	} catch (error) {
		log(`ERROR`, `Failed to create match channels`, error);
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
		log(`WARNING`, `Match ${payload.matchId} has no text channel target`);
		return;
	}

const mapInfo = await getRandomMapInfo(config);
const mmrDisplay = await isMmrDisplayEnabled();
const embed = buildMatchEmbed(payload, mapInfo, mmrDisplay);
	const components = buildMatchComponents(payload.matchId);
	const mentionLine = playerIds.map((id) => `<@${id}>`).join(` `);

	let textChannel =
		(channelDescriptor.textChannelId &&
			(await guild.channels.fetch(channelDescriptor.textChannelId).catch(() => null))) ||
		fallbackChannel;

	if (!textChannel) {
		log(`ERROR`, `No text channel available to post match ${payload.matchId}`);
		return;
	}

	try {
		const message = await textChannel.send({
			content: mentionLine,
			embeds: [embed],
			components,
		});

		await message.pin().catch(() => null);
		await updateMatchChannelsInRedis(payload.matchId, channelDescriptor);
	} catch (error) {
		log(`ERROR`, `Failed to send match embed`, error);
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
 	? `Team A: **${sumA}**\nTeam B: **${sumB}**\nΔ: **${diff}**`
 	: null;

	const embed = new EmbedBuilder()
		.setTitle(`MATCH FOUND!`)
		.setAuthor({ name: `VDC Queue Manager` })
		.setDescription(
			`**Tier**: ${payload.tier}\n` +
				`**Match ID**: ${payload.matchId}\n` +
				`**Map**: ${mapInfo.name}`,
		)
		.addFields(
			{ name: `Defenders Roster`, value: teamA || `TBD`, inline: true },
			{ name: `Attackers Roster`, value: teamB || `TBD`, inline: true },
		);

	if (mmrFieldValue) {
		embed.addFields({ name: `MMR Totals`, value: mmrFieldValue, inline: false });
	}

	embed.setFooter({ text: `Relaxed: ${payload.relaxed ? `Yes` : `No`}` });

	if (mapInfo.image) {
		embed.setImage(mapInfo.image);
	}

	return embed;
}

function buildMatchComponents(matchId) {
	const joinLobby = new ButtonBuilder()
		.setCustomId(`queueManager_joinLobby-${matchId}`)
		.setLabel(`Join Lobby VC`)
		.setStyle(ButtonStyle.Primary);

	const joinAttackers = new ButtonBuilder()
		.setCustomId(`queueManager_joinAttackers-${matchId}`)
		.setLabel(`Join Attackers`)
		.setStyle(ButtonStyle.Secondary);

	const joinDefenders = new ButtonBuilder()
		.setCustomId(`queueManager_joinDef-${matchId}`)
		.setLabel(`Join Def`)
		.setStyle(ButtonStyle.Secondary);

	const submitResult = new ButtonBuilder()
		.setCustomId(`queueManager_submit-${matchId}`)
		.setLabel(`Submit Result`)
		.setStyle(ButtonStyle.Success);

	return [
		new ActionRowBuilder({
			components: [joinLobby, joinAttackers, joinDefenders, submitResult],
		}),
	];
}

async function updateMatchChannelsInRedis(matchId, descriptor) {
	const redis = getRedisClient();
	await redis.hset(`vdc:match:${matchId}`, `channelIdsJSON`, JSON.stringify(descriptor));
	await redis.hset(`vdc:match:${matchId}`, `status`, `active`);
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
			log(`ERROR`, `Failed to parse Lua response`, error);
			return {};
		}
	}
	return response;
}

function runSafely(fn) {
	Promise.resolve()
		.then(fn)
		.catch((error) => log(`ERROR`, `Matchmaker tick failure`, error));
}

function filterStaffRoles(roleId, guild) {
	if (!roleId) return [];
	const role = guild.roles.cache.get(roleId);
	return role ? [role.id] : [];
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
		log(`WARNING`, `Unable to load map data`, error);
		valorantMapsCache = { data: [], timestamp: Date.now() };
		return [];
	}
}

module.exports = {
	startMatchmaker,
	stopMatchmaker,
	runMatchmakerOnce,
};
