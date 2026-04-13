const { DEFAULT_MAP_POOL } = require(`../../core/queue/queueconfig`);

let cachedMapPool = null;
let valorantMapsCache = null;

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
	getRandomMapInfo,
};
