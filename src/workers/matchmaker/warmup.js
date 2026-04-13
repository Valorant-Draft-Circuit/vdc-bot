const {
	DEFAULT_WARMUP_SECONDS,
	DEFAULT_WARMUP_MAX_POPS_PER_TICK,
	DEFAULT_WARMUP_MIN_SECONDS_BETWEEN_POPS,
} = require(`./constants`);

function resolveWarmupEndsAt(config) {
	const warmupSeconds = Math.max(
		0,
		Number(config?.matchmakerWarmupSeconds ?? DEFAULT_WARMUP_SECONDS) || DEFAULT_WARMUP_SECONDS,
	);
	if (warmupSeconds <= 0) return null;
	return Date.now() + warmupSeconds * 1000;
}

function buildWarmupState(config, options = {}, warmupEndsAt) {
	if (options.bypassWarmup) {
		return { active: false, maxPopsPerTick: Infinity, minSecondsBetweenPops: 0 };
	}

	const active = Boolean(warmupEndsAt && Date.now() < warmupEndsAt);
	if (!active) {
		return { active: false, maxPopsPerTick: Infinity, minSecondsBetweenPops: 0 };
	}

	const maxPopsPerTick = Math.max(
		1,
		Math.floor(
			Number(config?.matchmakerWarmupMaxPopsPerTick ?? DEFAULT_WARMUP_MAX_POPS_PER_TICK) ||
				DEFAULT_WARMUP_MAX_POPS_PER_TICK,
		),
	);
	const minSecondsBetweenPops = Math.max(
		0,
		Number(config?.matchmakerWarmupMinSecondsBetweenPops ?? DEFAULT_WARMUP_MIN_SECONDS_BETWEEN_POPS) ||
			DEFAULT_WARMUP_MIN_SECONDS_BETWEEN_POPS,
	);

	return {
		active,
		maxPopsPerTick,
		minSecondsBetweenPops,
	};
}

module.exports = {
	resolveWarmupEndsAt,
	buildWarmupState,
};
