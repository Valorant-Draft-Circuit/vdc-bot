const { startQueueRuntime } = require(`../core/queue/runtime`);
const { startModExpiry } = require(`../workers/modExpiry`);

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

		// moderation durability must not depend on the queue boot succeeding:
		// start the expiry runtime first so a queue failure can never silently
		// disable sanction lifts
		await startModExpiry(client);

		if ((/true/i).test(process.env.QUEUE_SYSTEM_ENABLED)) {
			await startQueueRuntime(client);
		} else {
			logger.log(`WARNING`, `Queue system disabled via QUEUE_SYSTEM_ENABLED=false. Skipping queue boot startup.`);
		}

		// initialize logger logdrain needs
		return await logger.init();
	},
};
