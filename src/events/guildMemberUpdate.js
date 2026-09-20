const { syncDiscordMedia } = require(`../helpers/discordMedia`);

module.exports = {

	/**
	 * Emitted whenever a guild member changes - i.e. new role, removed role, nickname, or their
	 * server profile (we will honor server avatar/banner),.
	 * @type {Event}
	 * @references
	 * @djs https://discord.js.org/#/docs/discord.js/main/class/Client?scrollTo=e-guildMemberUpdate
	 * @api https://discord.com/developers/docs/topics/gateway-events#guild-member-update
	 */

	name: `guildMemberUpdate`,
	once: false,

	async execute(client, oldMember, newMember) {
		const avatarChanged = oldMember.avatar !== newMember.avatar;
		const bannerChanged = (oldMember.banner ?? null) !== (newMember.banner ?? null);
		if (!avatarChanged && !bannerChanged) return;

		await syncDiscordMedia(newMember.user, newMember, { includeBanner: bannerChanged });
	},
};
