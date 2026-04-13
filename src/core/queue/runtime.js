const { preloadLuaScripts } = require(`../redis`);
const { bootstrapRedisIfNeeded, syncLeagueStateFromControlPanel } = require(`./bootstrap`);
const { startHealthMonitor } = require(`./health`);
const { startMatchmaker } = require(`../../workers/matchmaker`);
const { startQueueAutoCloseJob } = require(`./timeToClose`);

async function startQueueRuntime(client) {
	await preloadLuaScripts();
	await bootstrapRedisIfNeeded();
	await syncLeagueStateFromControlPanel();

	startHealthMonitor(client);
	startMatchmaker(client);
	startQueueAutoCloseJob();
}

module.exports = {
	startQueueRuntime,
};
