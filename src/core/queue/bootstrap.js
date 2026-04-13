const { prisma } = require(`../../../prisma/prismadb`);
const { Tier } = require(`@prisma/client`);
const { getRedisClient, runLua } = require(`../redis`);
const { LEAGUE_STATE_KEY, TIERS_SET_KEY } = require(`../../helpers/queue/queueKeys`);

async function readControlPanelLeagueState() {
	const leagueStateRow = await prisma.controlPanel.findFirst({
		where: { name: `league_state` },
		select: { value: true },
	});

	if (!leagueStateRow || !leagueStateRow.value) {
		throw new Error(`ControlPanel league_state is missing`);
	}

	return String(leagueStateRow.value).toLowerCase();
}

async function bootstrapRedisIfNeeded() {
	const redis = getRedisClient();
	const hasLeagueState = await redis.exists(LEAGUE_STATE_KEY);
	if (hasLeagueState) return false;

	const controlPanelLeagueState = await readControlPanelLeagueState();

	const tiers = Object.values(Tier).filter((value) => typeof value === `string` && String(value).toUpperCase() !== `MIXED`);

	const tierPayload = tiers.map((name) => ({
		name,
		open: false,
	}));

	await runLua(`bootstrap`, {
		keys: [LEAGUE_STATE_KEY, TIERS_SET_KEY],
		args: [controlPanelLeagueState, JSON.stringify(tierPayload)],
	});

	return true;
}

async function syncLeagueStateFromControlPanel() {
	const redis = getRedisClient();
	const controlPanelLeagueState = await readControlPanelLeagueState();
	const redisLeagueStateRaw = await redis.get(LEAGUE_STATE_KEY);
	const redisLeagueState = typeof redisLeagueStateRaw === `string`
		? redisLeagueStateRaw.toLowerCase()
		: null;

	if (redisLeagueState === controlPanelLeagueState) {
		return;
	}

	await redis.set(LEAGUE_STATE_KEY, controlPanelLeagueState);
	logger.log(`INFO`, `Synced Redis league state to Control Panel value: ${controlPanelLeagueState}`);
}

module.exports = {
	bootstrapRedisIfNeeded,
	syncLeagueStateFromControlPanel,
};
