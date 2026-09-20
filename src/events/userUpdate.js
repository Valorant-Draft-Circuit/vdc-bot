const { syncDiscordMedia } = require(`../helpers/discordMedia`);

module.exports = {

	/**
	 * Emitted whenever a user's global profile changes - i.e. avatar, banner, username.
	 * @type {Event}
	 * @references
	 * @djs https://discord.js.org/docs/packages/discord.js/main/Client:Class#userUpdate
	 * @api https://discord.com/developers/docs/topics/gateway-events#user-update
	 */

	name: `userUpdate`,
	once: false,

	async execute(client, oldUser, newUser) {
		const avatarChanged = oldUser.avatar !== newUser.avatar;
		const bannerChanged = oldUser.banner !== newUser.banner;
		if (!avatarChanged && !bannerChanged) return;

		const guild = client.guilds.cache.get(process.env.SERVER_ID);
		const guildMember = await guild?.members.fetch(newUser.id).catch(() => null) ?? null;

		await syncDiscordMedia(newUser, guildMember, { includeBanner: bannerChanged });
	},
};
