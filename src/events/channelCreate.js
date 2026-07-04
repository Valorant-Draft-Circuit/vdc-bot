const { GuildChannel } = require(`discord.js`);
const { ROLES } = require(`../../utils/enums`);

module.exports = {

	/**
	 * Emitted whenever a guild channel is created.
	 * Applies the Muted role deny-overrides so mutes stay airtight on new channels.
	 * @type {Event}
	 */

	name: `channelCreate`,
	once: false,

	async execute(client, /** @type {GuildChannel} */ channel) {
		if (!channel.guild) return;

		try {
			await channel.permissionOverwrites.create(ROLES.LEAGUE.MUTED, {
				SendMessages: false,
				SendMessagesInThreads: false,
				AddReactions: false,
				Speak: false,
			});
			logger.log(`INFO`, `Applied Muted overrides to new channel \`${channel.name}\` (\`${channel.id}\`)`);
		} catch (error) {
			logger.log(`WARNING`, `Could not apply Muted overrides to channel \`${channel.id}\`: ${error.message}`);
		}
	},
};
