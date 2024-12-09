const { EmbedBuilder, GuildMember, ChatInputCommandInteraction } = require(`discord.js`);
const { Player, Franchise, ControlPanel } = require(`../../../prisma`);
const { prisma } = require(`../../../prisma/prismadb`);
const { LeagueStatus, ContractStatus } = require("@prisma/client");
const { StatusEmotes, ROLES } = require("../../../utils/enums");

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
	if (!playerData.primaryRiotAccountID) return await interaction.editReply({ content: `I looked through our data and I don't see your Riot account linked anywhere! Please link one [here](https://vdc.gg/me)!` });

	// get the player's updated IGN from Riot's accountByPuuid endpoint
	const puuid = playerData.primaryRiotAccountID;
	const response = await fetch(`${getAccountByPuuid}/${puuid}?api_key=${process.env.VDC_API_KEY}`);
	if (!response.ok) return await interaction.editReply({ content: `There was a problem checking Riot's API! Please try again later and/or let a bot developer know!` });

	const { gameName, tagLine } = await response.json();
	const updatedIGN = `${gameName}#${tagLine}`;

	const ignFromDB = (await Player.getIGNby({ discordID: userId })).split(`#`)[0];
	const riotNameFromDB = ignFromDB.split(`#`)[0];

	/** @type GuildMember */
	const guildMember = await interaction.guild.members.fetch(userId);
	const updatedPlayer = await prisma.account.update({
		where: { providerAccountId: puuid },
		data: { riotIGN: updatedIGN }
	});
	if (updatedPlayer.riotIGN !== updatedIGN) return await interaction.editReply({ content: `Looks like there was an error and the database wasn't updated! Please try again later and/or let a bot developer know!` });

	// check to make sure the bot can update the user's nickname
	if (!guildMember.manageable) return await interaction.editReply({ content: `The database was updated to reflect your new IGN: (\`${updatedIGN}\`), but I can't update your nickname- your roles are higher than mine! You will need to update your nickname manually!` });

	const gmids = (await prisma.franchise.findMany({
		include: {
			GM: { include: { Accounts: true } },
			AGM1: { include: { Accounts: true } },
			AGM2: { include: { Accounts: true } },
			AGM3: { include: { Accounts: true } },
		}
	})).map(f => {
		return [
			f.GM?.Accounts.find(a => a.provider == `discord`).providerAccountId,
			f.AGM1?.Accounts.find(a => a.provider == `discord`).providerAccountId,
			f.AGM2?.Accounts.find(a => a.provider == `discord`).providerAccountId,
			f.AGM3?.Accounts.find(a => a.provider == `discord`).providerAccountId
		]
	}).flat().filter(v => v !== undefined);

	const isGM = gmids.includes(interaction.user.id);

	let slug = ``;
	switch (true) {
		case isGM:
			slug = (await prisma.franchise.findFirst({
				where: {
					OR: [
						{ GM: { Accounts: { some: { providerAccountId: interaction.user.id } } } },
						{ AGM1: { Accounts: { some: { providerAccountId: interaction.user.id } } } },
						{ AGM2: { Accounts: { some: { providerAccountId: interaction.user.id } } } },
						{ AGM3: { Accounts: { some: { providerAccountId: interaction.user.id } } } },
					]
				},
				include: { Brand: true }
			})).slug
			break;

		case playerData.team != null:
			slug = (await Franchise.getBy({ teamID: playerData.team })).slug
			break;

		case playerData.Status.leagueStatus == LeagueStatus.FREE_AGENT:
			slug = `FA`
			break;
		case playerData.Status.leagueStatus == LeagueStatus.DRAFT_ELIGIBLE:
			slug = `DE`
			break;
		default:
			slug = `RFA`
			break
	}
	const accolades = guildMember.nickname?.match(emoteregex);
	guildMember.setNickname(`${slug} | ${gameName} ${accolades ? accolades.join(``) : ``}`);

	const leagueState = await prisma.controlPanel.findFirst({ where: { name: `league_state` } });

	// remove all league roles and then add League & franchise role
	const franchiseRoleIDs = (await prisma.franchise.findMany({ where: { active: true } })).map(f => f.roleID);
	await guildMember.roles.remove([
		...Object.values(ROLES.LEAGUE),
		...Object.values(ROLES.TIER),
		...franchiseRoleIDs
	]);

	switch (playerData.Status.leagueStatus) {
		case LeagueStatus.DRAFT_ELIGIBLE:
			await guildMember.roles.add([
				ROLES.LEAGUE.LEAGUE,
				leagueState != `COMBINES` ? ROLES.TIER[team.tier] : null,
				ROLES.LEAGUE.DRAFT_ELIGIBLE
			].filter(rid => rid != null));
			break;
		case LeagueStatus.FREE_AGENT:
			await guildMember.roles.add([
				ROLES.LEAGUE.LEAGUE, ,
				ROLES.LEAGUE.FREE_AGENT,
				leagueState != `COMBINES` ? ROLES.TIER[team.tier] : null
			].filter(rid => rid != null));
			break;
		case LeagueStatus.RESTRICTED_FREE_AGENT:
			await guildMember.roles.add([
				ROLES.LEAGUE.LEAGUE,
				ROLES.LEAGUE.RESTRICTED_FREE_AGENT,
				leagueState != `COMBINES` ? ROLES.TIER[team.tier] : null
			].filter(rid => rid != null));
			break;
		case LeagueStatus.GENERAL_MANAGER:
			const playerFranchise = playerData.Team.Franchise;
			await guildMember.roles.add([
				ROLES.LEAGUE.LEAGUE,
				playerFranchise.gmID == playerData.id ? ROLES.OPERATIONS.GM : ROLES.OPERATIONS.AGM,
				leagueState != `COMBINES` ? ROLES.TIER[team.tier] : null,
				playerData.Team.Franchise.roleID
			].filter(rid => rid != null));
			break;
	}


	if (playerData.Status.contractStatus == ContractStatus.SIGNED) {
		await guildMember.roles.add([
			ROLES.LEAGUE.LEAGUE,
			leagueState != `COMBINES` ? ROLES.TIER[team.tier] : null,
			playerData.Team.Franchise.roleID
		].filter(rid => rid != null));
	} else {
		// update league roles
		if (leagueState != `COMBINES`) {
			const tierLines = await ControlPanel.getMMRCaps(`PLAYER`);
			const mmrEffective = Math.round(playerData.PrimaryRiotAccount.MMR.mmrEffective);
			switch (true) {
				case (tierLines.PROSPECT.min < mmrEffective && mmrEffective < tierLines.PROSPECT.max):
					await guildMember.roles.add([ROLES.TIER.PROSPECT, ROLES.TIER.PROSPECT_FREE_AGENT]);
					break;
				case tierLines.APPRENTICE.min < mmrEffective && mmrEffective < tierLines.APPRENTICE.max:
					await guildMember.roles.add([ROLES.TIER.APPRENTICE, ROLES.TIER.APPRENTICE_FREE_AGENT]);
					break;
				case tierLines.EXPERT.min < mmrEffective && mmrEffective < tierLines.EXPERT.max:
					await guildMember.roles.add([ROLES.TIER.EXPERT, ROLES.TIER.EXPERT_FREE_AGENT]);
					break;
				case tierLines.MYTHIC.min < mmrEffective && mmrEffective < tierLines.MYTHIC.max:
					await guildMember.roles.add([ROLES.TIER.MYTHIC, ROLES.TIER.MYTHIC_FREE_AGENT]);
					break;
			}
		}
	}

	// create the success update "announcement"
	const embed = new EmbedBuilder({
		description: `${guildMember}'s has updated & synced their profile!`,
		color: 0x008000,
		fields: [
			{ name: `From:`, value: riotNameFromDB, inline: true },
			{ name: `To:`, value: gameName, inline: true },
		],
		footer: { text: `Profile - Update` },
	});

	// ephemerally update status and then exit with the announcement
	await interaction.editReply({ content: `Success! The database, your roles, your nickname & your Riot IGN are all in sync!` });
	return await interaction.channel.send({ embeds: [embed] });
}
