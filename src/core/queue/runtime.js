const { preloadLuaScripts } = require(`../redis`);
const { bootstrapRedisIfNeeded } = require(`./bootstrap`);
const { startHealthMonitor } = require(`./health`);
const { startMatchmaker } = require(`../../workers/matchmaker`);
const { startQueueAutoCloseJob } = require(`./timeToClose`);

async function startQueueRuntime(client) {
	await preloadLuaScripts();
	await bootstrapRedisIfNeeded();

	startHealthMonitor(client);
	startMatchmaker(client);
	startQueueAutoCloseJob();
}

module.exports = {
	startQueueRuntime,
};
