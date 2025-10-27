const fs = require(`fs`);
const path = require(`path`);
const Redis = require(`ioredis`);

const LUA_DIRECTORY = path.resolve(__dirname, `../../utils/lua`);
const LUA_SCRIPTS = new Map();

let redisClient;
let lastConnectionErrorAt = 0;
let lastConnectionClosedAt = 0;

/**
 * Create or return the shared Redis client.
 * @returns {import('ioredis').Redis}
 */
function getRedisClient() {
	if (redisClient) return redisClient;

	const url = process.env.REDIS_URL ?? null;
	const connectionOptions = url
		? url
		: {
			host: process.env.REDIS_HOST,
			port: Number(process.env.REDIS_PORT ?? 6379),
			password: process.env.REDIS_PASSWORD ?? undefined,
			db: Number(process.env.REDIS_DB ?? 0),
		};

	redisClient = new Redis(connectionOptions);

	redisClient.on(`error`, (error) => {
		const now = Date.now();
		if (now - lastConnectionErrorAt > 15000) {
			lastConnectionErrorAt = now;
			logger.log(`ERROR`, `Redis connection error`, error);
		}
	});
	redisClient.on(`connect`, () => {
		lastConnectionErrorAt = 0;
		logger.log(`DEBUG`, `Redis connection established`);
	});
	redisClient.on(`close`, () => {
		const now = Date.now();
		if (now - lastConnectionClosedAt > 15000) {
			lastConnectionClosedAt = now;
			logger.log(`WARNING`, `Redis connection closed`);
		}
	});

	return redisClient;
}

/**
 * Load a Lua script by name and cache its SHA hash.
 * @param {string} scriptName
 * @returns {Promise<string>}
 */
async function loadLuaScript(scriptName) {
	const redis = getRedisClient();
	const scriptPath = path.join(LUA_DIRECTORY, `${scriptName}.lua`);

	const source = await fs.promises.readFile(scriptPath, `utf8`);
	const sha = await redis.script(`load`, source);

	LUA_SCRIPTS.set(scriptName, { sha, source });
	return sha;
}

/**
 * Run a named Lua script with provided keys and arguments.
 * @param {string} scriptName
 * @param {{ keys?: string[]; args?: string[] }} [payload]
 * @returns {Promise<unknown>}
 */
async function runLua(scriptName, payload = {}) {
	const { keys = [], args = [] } = payload;
	const redis = getRedisClient();

	let script = LUA_SCRIPTS.get(scriptName);
	if (!script) {
		await loadLuaScript(scriptName);
		script = LUA_SCRIPTS.get(scriptName);
	}

	try {
		return await redis.evalsha(script.sha, keys.length, ...keys, ...args);
	} catch (error) {
		if (typeof error?.message === `string` && error.message.includes(`NOSCRIPT`)) {
			await loadLuaScript(scriptName);
			const reloaded = LUA_SCRIPTS.get(scriptName);
			return await redis.evalsha(reloaded.sha, keys.length, ...keys, ...args);
		}

		throw error;
	}
}

/**
 * Preload all Lua scripts located in utils/lua.
 * Intended to be called during startup.
 * @returns {Promise<void>}
 */
async function preloadLuaScripts() {
	try {
		const files = await fs.promises.readdir(LUA_DIRECTORY, { withFileTypes: true });
		const luaFiles = files.filter((entry) => entry.isFile() && entry.name.endsWith(`.lua`));

		for (const file of luaFiles) {
			const scriptName = file.name.replace(/\.lua$/, ``);
			await loadLuaScript(scriptName);
		}
	} catch (error) {
		logger.log(`WARNING`, `Unable to preload Lua scripts`, error);
	}
}

/**
 * Close the Redis connection gracefully.
 * @returns {Promise<void>}
 */
async function disconnectRedis() {
	if (!redisClient) return;
	try {
		await redisClient.quit();
	} finally {
		redisClient = undefined;
	}
}

module.exports = {
	getRedisClient,
	runLua,
	preloadLuaScripts,
	disconnectRedis,
	LUA_DIRECTORY,
};
