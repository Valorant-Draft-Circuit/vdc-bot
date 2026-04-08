const CONTROL_PANEL_MAP_POOL_KEY = `MAP_POOL`;
const CONTROL_PANEL_DISPLAY_KEY = `display_mmr`;

const DEFAULT_QUEUE_CONFIG = Object.freeze({
	enabled: false,
	health: {
		checkIntervalMs: 5000,
		dbTimeoutMs: 1000,
	},
	mapPool: [],
	perTierFlags: {},
	relaxSeconds: 180,
	recentSetTtlSeconds: 180,
	cancelThreshold: 80,
	channelStopThreshold: 480,
	matchmakerWarmupSeconds: 0,
	matchmakerWarmupMaxPopsPerTick: 1,
	matchmakerWarmupMinSecondsBetweenPops: 5,
	matchSize: 5,
	maxScanPerBucket: 400,
});

module.exports = {
	CONTROL_PANEL_MAP_POOL_KEY,
	CONTROL_PANEL_DISPLAY_KEY,
	DEFAULT_QUEUE_CONFIG,
};
