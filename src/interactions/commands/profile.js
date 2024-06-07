const { EmbedBuilder, GuildMember, ChatInputCommandInteraction } = require(`discord.js`);
const { Player, Franchise } = require(`../../../prisma`);
const { prisma } = require(`../../../prisma/prismadb`);
const { LeagueStatus } = require("@prisma/client");
const { StatusEmotes } = require("../../../utils/enums");

/** Riot's API endpoint to fetch a user's account by their puuid 
 * @TODO Update to the internal VDC endpoint once it's ready */
const getAccountByPuuid = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-puuid`;

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

module.exports = {
	name: `profile`,

	async execute(/** @type ChatInputCommandInteraction */ interaction) {
		await interaction.deferReply();

		const { _subcommand, hoistedOptions } = interaction.options;

		switch (_subcommand) {
			case `user`:
				return await user(interaction);
			case `update`:
				return await update(interaction);
			default:
				return await interaction.editReply({ content: `That's not a valid subcommand or this command is a work in progress!` });
		}
	},
};

async function user(/** @type ChatInputCommandInteraction */ interaction) {
	const discordID = interaction.options._hoistedOptions[0].value;
	// console.log(discordID)

	const player = await Player.getBy({ discordID: discordID });
	// const stats = awa

	console.log(player)

	// if there is a tagged user, use that, otherwise use the interaction author
	const guildMember = interaction.options._hoistedOptions.length > 0 ? interaction.guild.members.cache.get(interaction.options._hoistedOptions[0].value) : interaction.member;
	const guildUser = guildMember.user;
	const guildNickname = guildMember.nickname ? guildMember.nickname : guildMember.user.username;
	const guildUserAvatar = guildUser.displayAvatarURL({ format: "png", dynamic: true });

	// get the member's roles
	const allUserRoles = guildMember.roles.cache.sort((a, b) => b.position - a.position).map(r => r);
	const serverRoles = allUserRoles.slice(0, allUserRoles.length - 1).join(`, `);

	// get account join information & convert to date, time & days elapsed
	const discordJoinDate = new Date(guildMember.user.createdAt)
	const discordDateJoined = discordJoinDate.toLocaleString(`en-US`, { month: "long", day: "numeric", year: "numeric" });
	const discordTimeJoined = discordJoinDate.toLocaleString(`en-US`, { hour: "numeric", minute: "numeric", timeZoneName: "short" });
	const accountAge = Math.floor((Date.now() - discordJoinDate) / 86400000);

	// get user's server join information & convert to date, time & days elapsed
	const serverJoinDate = new Date(guildMember.joinedTimestamp)
	const serverDateJoined = serverJoinDate.toLocaleString(`en-US`, { month: "long", day: "numeric", year: "numeric" });
	const serverTimeJoined = serverJoinDate.toLocaleString(`en-US`, { hour: "numeric", minute: "numeric", timeZoneName: "short" });
	const daysOnServer = Math.floor((Date.now() - serverJoinDate) / 86400000);

	// determine online presenceStatus
	let presenceStatus = `**Presence:** `;
	let memberPresence = guildMember.presence == null ? `offline` : guildMember.presence.status;
	switch (memberPresence) {
		case `online`:
			presenceStatus += `<:online:${StatusEmotes.ONLINE}> Online`;
			break;
		case `idle`:
			presenceStatus += `<:idle:${StatusEmotes.IDLE}> Idle`;
			break;
		case `dnd`:
			presenceStatus += `<:dnd:${StatusEmotes.DND}> Do Not Disturb`;
			break;
		default:
			presenceStatus += `<:offline:${StatusEmotes.OFFLINE}> Offline`;
			break;
	}

	const riotAccounts = player.Accounts.filter(a => a.provider === `riot`).map(a => `[\`${a.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(a.riotIGN)}`})`).join(`, `)

	const embed = new EmbedBuilder({
		author: { name: `User Profile: ${guildNickname}`, icon_url: guildUserAvatar },
		description:
			`**Discord ID:** ${guildUser.id}\n` +
			`**Username:** ${guildUser.username}\n` +
			`**User Tag:** <@!${guildUser.id}>\n` +
			`${presenceStatus}\n` +
			`**Roles**: \`${player.roles}\`\n**Flags**: \`${player.flags}\`\n\n` +
			`**Server Roles:** ${serverRoles}`,
		// thumbnail: { url: guildUserAvatar },
		color: 0xE92929,
		fields: [
			{
				name: `\u200B`, value: `**League Information**:\n` +
					`**League Status**: ${player.Status.leagueStatus}\n` +
					`**Contract Status**: ${player.Status.contractStatus}\n` +
					`**Contract Remaining**: ${player.Status.contractRemaining}\n`
				, inline: true
			},
			{ name: `\u200B`, value: `**Riot Accounts**:\n${riotAccounts}`, inline: true },
			{
				name: `\u200B`, value: `**Miscellaneous Info**:\n` +
					`UID: \`${player.id}\`\n` +
					`TID: \`${player.team}\`\n` +
					`FID: \`${player.team ? player.Team.Franchise.id : undefined}\`\n`
				, inline: false
			},
			{ name: `\u200B`, value: `**Joined Discord:**\n${discordDateJoined}\n${discordTimeJoined}\nAccount Age: ${accountAge} Days`, inline: true },
			{ name: `\u200B`, value: `\u200B`, inline: true },
			{ name: `\u200B`, value: `**Joined ${interaction.guild}:**\n${serverDateJoined}\n${serverTimeJoined}\nTime on Server: ${daysOnServer} Days`, inline: true }
		],
		// timestamp: Date.now()
		footer: { text: `Valorant Draft Circuit - ${guildNickname}`, icon_url: guildUserAvatar },

	});

	return await interaction.editReply({ embeds: [embed], ephemeral: false });
}

async function update(/** @type ChatInputCommandInteraction */ interaction) {
	const userId = interaction.user.id;
	const playerData = await Player.getBy({ discordID: userId });
	if (!playerData.primaryRiotAccountID) return await interaction.editReply({ content: `I looked through our filing cabinets and I don't see your Riot account linked anywhere! Please link one [here](https://vdc.gg/me)!` });

	// get the player's updated IGN from Riot's accountByPuuid endpoint
	const puuid = playerData.primaryRiotAccountID;
	const response = await fetch(`${getAccountByPuuid}/${puuid}?api_key=${process.env.VDC_API_KEY}`);
	if (!response.ok) return await interaction.editReply({ content: `There was a problem checking Riot's filing cabinets! Please try again later and/or let a bot developer know!` });

	const { gameName, tagLine } = await response.json();
	const updatedIGN = `${gameName}#${tagLine}`;

	const ignFromDB = (await Player.getIGNby({ discordID: userId })).split(`#`)[0];
	const riotNameFromDB = ignFromDB.split(`#`)[0];

	/** @type GuildMember */
	const guildMember = await interaction.guild.members.fetch(userId);

	// If database value is the exact same from the API call, don't update the database- simply continue & try to update the nickname
	if (ignFromDB === gameName && guildMember.nickname?.includes(gameName)) {
		return await interaction.editReply({ content: `Well... This is awkward. The database already has your most up-to-date IGN and upon some super close inspection, your nickname looks like it's correct as well!!` });
	} else {
		const updatedPlayer = await prisma.account.update({
			where: { providerAccountId: puuid },
			data: { riotIGN: updatedIGN }
		});
		if (updatedPlayer.riotIGN !== updatedIGN) return await interaction.editReply({ content: `Looks like there was an error and the database wasn't updated! Please try again later and/or let a bot developer know!` });
	}

	// check to make sure the bot can update the user's nickname
	if (!guildMember.manageable) return await interaction.editReply({ content: `The database was updated to reflect your new IGN: (\`${updatedIGN}\`), but I can't update your nickname- your roles are higher than mine! You will need to update your nickname manually!` });

	// update the user's nickname in the server
	const slug = playerData.team ? (await Franchise.getBy({ teamID: playerData.team })).slug : playerData.Status.leagueStatus == LeagueStatus.FREE_AGENT ? `FA` : playerData.Status.leagueStatus == LeagueStatus.DRAFT_ELIGIBLE ? `DE` : `RFA`;
	const accolades = guildMember.nickname?.match(emoteregex);
	guildMember.setNickname(`${slug} | ${gameName} ${accolades ? accolades.join(``) : ``}`);

	// create the success update "announcement"
	const embed = new EmbedBuilder({
		description: `${guildMember}'s nickname has been updated!`,
		color: 0x008000,
		fields: [
			{ name: `From:`, value: riotNameFromDB, inline: true },
			{ name: `To:`, value: gameName, inline: true },
		],
		footer: { text: `Profile - Update` },
	});

	// ephemerally update status and then exit with the announcement
	await interaction.editReply({ content: `Success! The database, your nickname & your Riot IGN are all in sync!` });
	return await interaction.channel.send({ embeds: [embed] });
}
