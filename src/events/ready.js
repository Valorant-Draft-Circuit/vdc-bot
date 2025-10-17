const { startHealthMonitor } = require(`../core/health`);
const { preloadLuaScripts } = require(`../core/redis`);
const { bootstrapRedisIfNeeded } = require(`../core/bootstrap`);
const { startMatchmaker } = require(`../workers/matchmaker`);
const { setTierState } = require(`../interactions/subcommands/queue/admin`);

module.exports = {

	/**
	 * Emitted whenever a guild member changes - i.e. new role, removed role, nickname.
	 * @type {Event}
	 * @references
	 * @djs https://discord.js.org/#/docs/discord.js/main/class/Client?scrollTo=e-ready
	 * @api https://discord.com/developers/docs/topics/gateway-events#ready 
	 */

	name: `ready`,
	once: true,

	async execute(client) {
		logger.log(`INFO`, `${client.user.tag} is online!`);

		// register slash commands
		client.registerSlashCommands(client, `./utils/commandsStructure`);

		const emotes = (await client.application.emojis.fetch()).map(e => e);
		logger.log(`INFO`, `Found \`${emotes.length}\` application emote(s)`);

		await preloadLuaScripts();
		await bootstrapRedisIfNeeded();

		startHealthMonitor(client);
		startMatchmaker(client);

		// Schedule a daily job to auto-close all queues at 08:00 UTC (3:00 AM CT).
		// Calculate ms until next 08:00 UTC and set a timeout, then repeat every 24 hours.

		function msUntilNextHourUtc(targetHour) {
			const now = new Date();
			const next = new Date(now.toISOString());
			next.setUTCHours(targetHour, 0, 0, 0);
			if (next.getTime() <= now.getTime()) {
				next.setUTCDate(next.getUTCDate() + 1);
			}
			return next.getTime() - now.getTime();
		}

		async function closeAllTiersJob() {
			try {
				// Pass `ALL` to resolveTiers logic used by admin handlers — setTierState expects tier list.
				// We'll resolve tiers inside using redis like the admin command would.
				const redis = require(`../core/redis`).getRedisClient();
				const tiers = await redis.smembers(`vdc:tiers`);
				if (!Array.isArray(tiers) || tiers.length === 0) return;
				await setTierState(tiers, false);
				logger.log(`INFO`, `Auto-closed all queues at 08:00 UTC`);
			} catch (err) {
				logger.log(`ERROR`, `Failed to auto-close queues`, err);
			}
		}

		const initialDelay = msUntilNextHourUtc(8);
		setTimeout(() => {
			// run immediately at the scheduled time
			closeAllTiersJob();
			// schedule subsequent runs every 24 hours
			setInterval(closeAllTiersJob, 24 * 60 * 60 * 1000).unref?.();
		}, initialDelay).unref?.();

		// initialize logger logdrain needs
		return await logger.init();
	},
};
