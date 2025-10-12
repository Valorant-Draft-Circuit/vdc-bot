const { getQueueConfig } = require(`./config`);

async function isMmrDisplayEnabled() {
	const config = await getQueueConfig();
	return Boolean(config.displayMmr);
}

module.exports = {
	isMmrDisplayEnabled,
};
