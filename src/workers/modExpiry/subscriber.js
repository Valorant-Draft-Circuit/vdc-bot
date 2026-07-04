const { Client } = require(`discord.js`);
const { getRedisClient } = require(`../../core/redis`);
const { EXPIRY_KEY_PREFIX } = require(`../../helpers/mod/muteState`);
const { liftMute, liftBan, announceExpiredLift } = require(`../../helpers/mod/enforcement`);
const { GUILD } = require(`../../../utils/enums`);

let subscriberClient;

/** Subscribe a dedicated connection to Redis expired-key events and lift
 * punishments in real time. (A subscribed ioredis connection cannot run other
 * commands, hence the duplicate; this also avoids contending with the queue.)
 * @param {Client} client
 */
async function startExpirySubscriber(client) {
	const redis = getRedisClient();
	await redis.config(`SET`, `notify-keyspace-events`, `Ex`);

	const db = Number(process.env.REDIS_DB ?? 0);
	subscriberClient = redis.duplicate();
	await subscriberClient.subscribe(`__keyevent@${db}__:expired`);

	subscriberClient.on(`message`, async (channel, expiredKey) => {
		if (!expiredKey.startsWith(EXPIRY_KEY_PREFIX)) return;

		const [type, discordID] = expiredKey.slice(EXPIRY_KEY_PREFIX.length).split(`:`);
		const guild = await client.guilds.fetch(GUILD).catch(() => null);
		if (!guild) return;

		try {
			if (type === `MUTE`) {
				await liftMute(guild, discordID);
				await announceExpiredLift(guild, `UNMUTE`, discordID);
			} else if (type === `BAN`) {
				await liftBan(guild, discordID, `Ban expired`);
				await announceExpiredLift(guild, `UNBAN`, discordID);
			}
			logger.log(`INFO`, `Expired ${type} lifted for ${discordID}`);
		} catch (error) {
			logger.log(`ERROR`, `Failed lifting expired ${type} for ${discordID}`, error.stack);
		}
	});

	logger.log(`INFO`, `Mod expiry subscriber listening on __keyevent@${db}__:expired`);
}

function stopExpirySubscriber() {
	if (subscriberClient) subscriberClient.disconnect();
	subscriberClient = undefined;
}

module.exports = { startExpirySubscriber, stopExpirySubscriber };
