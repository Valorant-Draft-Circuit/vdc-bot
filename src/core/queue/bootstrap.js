const { prisma } = require(`../../../prisma/prismadb`);
const { Tier } = require(`@prisma/client`);
const { getRedisClient, runLua } = require(`../redis`);
const { LEAGUE_STATE_KEY, TIERS_SET_KEY } = require(`../../helpers/queue/queueKeys`);

async function bootstrapRedisIfNeeded() {
	const redis = getRedisClient();
	const hasLeagueState = await redis.exists(LEAGUE_STATE_KEY);
	if (hasLeagueState) return false;

	const leagueStateRow = await prisma.controlPanel.findFirst({
		where: { name: `league_state` },
		select: { value: true },
	});

	if (!leagueStateRow || !leagueStateRow.value) {
		throw new Error(`ControlPanel league_state is missing`);
	}

	const tiers = Object.values(Tier).filter((value) => typeof value === `string` && String(value).toUpperCase() !== `MIXED`);

	const tierPayload = tiers.map((name) => ({
		name,
		open: false,
	}));

	await runLua(`bootstrap`, {
		keys: [LEAGUE_STATE_KEY, TIERS_SET_KEY],
		args: [String(leagueStateRow.value).toLowerCase(), JSON.stringify(tierPayload)],
	});

	return true;
}

module.exports = {
	bootstrapRedisIfNeeded,
};
