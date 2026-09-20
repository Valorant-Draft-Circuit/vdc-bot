const { prisma } = require(`../../prisma/prismadb`);
const { updateMeilisearchPlayer } = require(`../../utils/web/vdcWeb`);

// server pfp/banner beats the global one everywhere we store discord media
function memberAvatarURL(guildMember) {
	return guildMember.displayAvatarURL({ size: 2048 });
}

function memberBannerURL(guildMember) {
	return guildMember.bannerURL?.({ size: 2048 }) ?? guildMember.user.bannerURL({ size: 2048 }) ?? null;
}

// guildMember can be null if they left the server. we only touch the banner when the event was
// actually about it. the events discord sends us usually don't include the banner at all
async function syncDiscordMedia(discordUser, guildMember, { includeBanner }) {
	try {
		const account = await prisma.account.findFirst({
			where: { provider: `discord`, providerAccountId: discordUser.id },
			select: { userId: true },
		});
		if (!account) return;

		logger.log(`DEBUG`, `Player ${discordUser.username}'s pfp/banner change detected. Attempting to update...`);

		// discord doesn't hand over the banner until we fetch, so without this we'd overwrite a real banner with null
		if (includeBanner) await discordUser.fetch(true).catch(() => null);

		const data = { image: guildMember ? memberAvatarURL(guildMember) : discordUser.displayAvatarURL({ size: 2048 }) };
		if (includeBanner) data.banner = guildMember ? memberBannerURL(guildMember) : (discordUser.bannerURL({ size: 2048 }) ?? null);

		await prisma.user.update({
			where: { id: account.userId },
			data: data,
		});
		await updateMeilisearchPlayer(account.userId);
		logger.log(`INFO`, `Successfully auto-synced Discord pfp/banner for user ${account.userId} (${discordUser.username})`);
	} catch (error) {
		logger.log(`ERROR`, `Failed to sync Discord pfp/banner for user ${discordUser.id}`, error.stack);
	}
}

module.exports = { memberAvatarURL, memberBannerURL, syncDiscordMedia };
