const { Message } = require(`discord.js`);
const { prisma } = require("../../prisma/prismadb");

const tierChannels = !Boolean(Number(process.env.PROD)) ? {
	/** @development */
	PROSPECT: `1059244366671118487`,
	APPRENTICE: `1059244366671118487`,
	EXPERT: `1059244366671118487`,
	MYTHIC: `1059244366671118487`,
} : {
	/** @production */
	PROSPECT: `1220189359475785839`,
	APPRENTICE: `1220189437573464155`,
	EXPERT: `1220189333051674624`,
	MYTHIC: `1220189158467965048`,
};

const NUMBERS_WEBHOOK_ID = `1355710580303990935`;	    // numbers webook
// const NUMBERS_WEBHOOK_ID = `1238511449173917737`;		// bot-spam test webook

const trackerBaseURL = `https://tracker.gg/valorant/match/`;
const matchIDRegex = /(?<=Match ID \(DATABASE\): )\d+/;

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

	async execute(client, /** @type Message */ message) {

		/** allow me to message via the bot */
		if (message.author.id == `382893405178691584` && message.content.startsWith(`$say`)) {
			message.delete();
			return message.channel.send(message.content.replace(`$say `, ``))
		}

		/** forward messages to the right channel */
		if (message.author.id == NUMBERS_WEBHOOK_ID) {
			if (message.embeds[0].title !== `Game Processed!`) return;

			const embeddescription = message.embeds[0].description;
			const matchID = Number(embeddescription.match(matchIDRegex)[0]);

			logger.log(`VERBOSE`, `Detected successful match submission - Match ID: ${matchID}`);
			const match = await prisma.matches.findFirst({
				where: { matchID: matchID },
				include: {
					Games: true,
					Home: { include: { Franchise: { include: { Brand: true } } } },
					Away: { include: { Franchise: { include: { Brand: true } } } },
				}
			});

			if (!match) return logger.log(`WARNING`, `Match ID: ${matchID} not found in the database`);
			if (match.matchType !== `BO2`) return logger.log(`VERBOSE`, `Match ID: ${matchID} is not a BO2 match, skipping announcement`);
			if (match.Games.length !== 2) return logger.log(`VERBOSE`, `Match ID: ${matchID} only has one map, skipping announcement`);

			const homeTeam = match.Home;
			const awayTeam = match.Away;0

			const map1 = match.Games[0];
			const map2 = match.Games[1];

			const line1 = `<${homeTeam.Franchise.Brand.discordEmote}> **${homeTeam.name}** vs. <${awayTeam.Franchise.Brand.discordEmote}> **${awayTeam.name}**`;
			const line2 = `Final: || [${map1.map} ${map1.roundsWonHome} - ${map1.roundsWonAway}](${trackerBaseURL}${map1.gameID}), [${map2.map} ${map2.roundsWonHome} - ${map2.roundsWonAway}](${trackerBaseURL}${map2.gameID}) || — [Match Page](https://vdc.gg/match/${matchID})`;
			const line3 = `-# ${match.tier.charAt(0).toUpperCase() + match.tier.substring(1).toLowerCase()} — Match Day ${match.matchDay} — Regular Season`;

			const channel = await client.channels.fetch(tierChannels[match.tier]);

			channel.send({ content: [line1, line2, line3].join(`\n`) });
			logger.log(`INFO`, `Sent match results for Match ID: ${matchID} to ${channel.name} (${channel.id})`);
		}

		return;


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