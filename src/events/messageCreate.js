const { Message } = require(`discord.js`);

module.exports = {

	/**
	 * Emitted whenever a message is created.
	 * @type {Event}
	 * @references
	 * @djs https://discord.js.org/#/docs/discord.js/main/class/Client?scrollTo=e-messageCreate
	 * @api https://discord.com/developers/docs/topics/gateway-events#message-create
	 */

	name: `messageCreate`,
	once: false,

	execute(client, /** @type Message */ message) {

		/** Placeholder - For the time being, ignore ALL messages */

		const leeDiscordID = `1126098353676103711`;
		if (message.author.id == leeDiscordID) return message.react(`🟩`);
		else return;


		/** MessageCreate
		 * @param {Client} client The active BotClient instance
		 * @param {Object} message Message object emitted on MessageCreate
		 * 
		 * @todo 		Better DM handling to include files/attachments and images
		 * @todo	 	Create automod & it's functions
		 * @feature 	Create DM channel as "support" style ticket so when a bot is DMed, it can "open a support ticket"
		 */

		// if (message.author.bot) return;
		// if (message.channel.type === `DM`) return;
	},
};