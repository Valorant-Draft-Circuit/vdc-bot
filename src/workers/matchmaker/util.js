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

module.exports = {
	deriveTiersFromCache,
	parseLuaJson,
	runSafely,
};
