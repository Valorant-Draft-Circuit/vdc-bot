module.exports = {

	/**
	 * Emitted whenever a guild member changes - i.e. new role, removed role, nickname.
	 * @type {Event}
	 * @references
	 * @djs https://discord.js.org/#/docs/discord.js/main/class/Client?scrollTo=e-guildMemberUpdate
	 * @api https://discord.com/developers/docs/topics/gateway-events#guild-member-update 
	 */

	name: `guildMemberUpdate`,
	once: false,

	async execute(client, oldMember, newMember) {
		/** Placeholder - For the time being, ignore ALL guildMemberUpdates */
		return;
	},
};