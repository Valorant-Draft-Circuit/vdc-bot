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
		client.logger.console({
			level: `INFO`,
			title: `${client.user.tag} is online!`,
		});

		// set activity
		const presenceConfig = client.config.PRESENCE;
		client.user.setActivity(presenceConfig.MESSAGE, { type: presenceConfig.TYPE });

		// register slash commands
		client.registerSlashCommands(client, `./utils/commandsStructure`);

		// pass active BotClient to logger & then initialize the logger class
		client.logger.client = client;
		client.logger.init();
	},
};