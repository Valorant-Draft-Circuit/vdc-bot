const crypto = require(`node:crypto`);

const QUEUE_ID_MIN = 1000000;
const QUEUE_ID_MAX = 99999999;

function generateQueueId(redis) {
	return generateOkayId(redis);
}

function generateOkayId(redis, attempts = 5) {
	const id = String(randomInt(QUEUE_ID_MIN, QUEUE_ID_MAX + 1));
	const key = `vdc:match:${id}`;

	if (!redis) return id;

	return redis.exists(key).then((exists) => {
		if (!exists) return id;
		if (attempts <= 0) return `${Date.now()}`;
		return generateOkayId(redis, attempts - 1);
	});
}

function randomInt(min, max) {
	const range = max - min;
	if (range <= 0) return min;
	const bytes = crypto.randomBytes(6); // 48-bit
	const randomValue = bytes.readUIntBE(0, 6);
	return min + (randomValue % range);
}

module.exports = {
	generateQueueId,
};
