const { EmbedBuilder, GuildMember, ChatInputCommandInteraction } = require(`discord.js`);
const { Player, Franchise, ControlPanel, Roles } = require(`../../../prisma`);
const { prisma } = require(`../../../prisma/prismadb`);
const { LeagueStatus, ContractStatus } = require("@prisma/client");
const { StatusEmotes, ROLES } = require("../../../utils/enums");
const { updateMeilisearchPlayer } = require("../../../utils/web/vdcWeb");

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

	const player = await Player.getBy({ discordID: discordID });
	if (player == null) return await interaction.editReply(`This player (<@${discordID}>) does not exist in our database!`);

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

	// if user's discord pfp in db is invalid, they've probably changed it before we got to update it.
	const response = await fetch(player.image)
	if (!response.ok) {
		logger.log(`DEBUG`, `Player ${player.id}'s discord image from the database is invalid. Attempting to update...`);
		const user = await prisma.user.update({
			where: { id: player.id },
			data: { image: guildUserAvatar },
		});
		if (user.image !== guildUserAvatar) logger.log(`ERROR`, `Failed to update player ${player.id}'s discord image in our DB. Silently failing...`)
		else {
			updateMeilisearchPlayer(player.id)
			logger.log(`INFO`, `Successfully updated player ${player.id}'s discord image in our DB.`)
		}
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
	const userID = interaction.user.id;
	let progress = []

	// Check our database
	// --------------------------------------------------------------------------------------------
	progress.push(`🔍 Searching the VDC database for you & your accounts...`);
	await interaction.editReply(progress.join(`\n`));

	const player = await Player.getBy({ discordID: userID });
	if (!player.primaryRiotAccountID) {
		progress[progress.length - 1] =
			`❌ I looked through our database and I don't see your Riot account linked anywhere! Please link one [here](https://vdc.gg/me)!`;
		return await interaction.editReply(progress.join(`\n`));
	}

	progress[progress.length - 1] = `✅ Found user \`${player.PrimaryRiotAccount.riotIGN}\`!`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------

	// Update database to current discord username
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Syncing your Discord username...`);
	await interaction.editReply(progress.join(`\n`));

	// get the player's current discord username
	const discordUsername = interaction.user.username;
	const updatedUsername = await prisma.user.update({
		where: { id: player.id },
		data: { name: discordUsername },
	});
	if (updatedUsername.name !== discordUsername) {
		progress[progress.length - 1] =
			`❌ Looks like there was an error and we weren't able to sync your Discord username! Please try again later and/or let a member of the tech team know!`;
		return await interaction.editReply(progress.join(`\n`));
	}

	progress[progress.length - 1] = `✅ Synced your Discord username (\`${discordUsername}\` -> \`${updatedUsername.name}\`)`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------

	// Get most recent riotIGN from Riot
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Fetching your current Riot IGN from Riot's servers...`);
	await interaction.editReply(progress.join(`\n`));

	// get the player's updated IGN from Riot's accountByPuuid endpoint
	const puuid = player.primaryRiotAccountID;
	const response = await fetch(`${getAccountByPuuid}/${puuid}?api_key=${process.env.VDC_API_KEY}`);
	if (!response.ok) {
		progress[progress.length - 1] =
			`❌ There was a problem checking Riot's API! Please try again later and/or let a member of the tech team know!`;
		return await interaction.editReply(progress.join(`\n`));
	}

	const { gameName, tagLine } = await response.json();
	const updatedIGN = `${gameName}#${tagLine}`;

	progress[progress.length - 1] = `✅ Received IGN \`${updatedIGN}\` from Riot!`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// For each alt account, update the database
	// --------------------------------------------------------------------------------------------
	progress.push(`🔍 Looking for your alt accounts...`);
	await interaction.editReply(progress.join(`\n`));

	// get the total number of alts the user has
	const altAccounts = player.Accounts.filter(a => a.provider == `riot` && a.providerAccountId !== puuid);

	if (altAccounts.length == 0) {				// NO ALTS
		progress[progress.length - 1] = `✅ You have no alt accounts registered with VDC!`;
		await interaction.editReply(progress.join(`\n`));

	} else {									// ALTS
		progress[progress.length - 1] = `✅ Found \`${altAccounts.length}\` alt accounts registered with VDC!`;
		await interaction.editReply(progress.join(`\n`));

		// iterate through each alt 
		for (let i = 0; i < altAccounts.length; i++) {
			const altAccount = altAccounts[i];

			progress.push(`> 🔃 Updating account with IGN \`${altAccount.riotIGN}\`...`);
			await interaction.editReply(progress.join(`\n`));

			// get the alt's updated IGN from Riot's accountByPuuid endpoint
			const puuid = altAccount.providerAccountId;
			const response = await fetch(`${getAccountByPuuid}/${puuid}?api_key=${process.env.VDC_API_KEY}`);
			if (!response.ok) {
				progress[progress.length - 1] =
					`> ❌ There was a problem checking Riot's API for account \`${altAccount.riotIGN}\`! Please try again later and/or let a member of the tech team know!`;
				return await interaction.editReply(progress.join(`\n`));
			}

			const { gameName, tagLine } = await response.json();
			const updatedAltIGN = `${gameName}#${tagLine}`;

			// update the database
			const updatedAltAccount = await prisma.account.update({
				where: { providerAccountId: puuid },
				data: { riotIGN: updatedAltIGN }
			});

			if (updatedAltAccount.riotIGN !== updatedAltIGN) {
				progress[progress.length - 1] =
					`> ❌ There was an error updating the databse for \`${altAccount.riotIGN}\`! Please try again later and/or let a member of the tech team know!`;
				return await interaction.editReply(progress.join(`\n`));
			}

			progress[progress.length - 1] = `> ✅ Updated alt \`${i + 1}\` of \`${altAccounts.length}\` (\`${altAccount.riotIGN}\` -> \`${updatedAltIGN}\`)`;
			await interaction.editReply(progress.join(`\n`));

		}
	}
	// --------------------------------------------------------------------------------------------


	// Get our current info about the player & update the database to the most recent ign
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Getting your current information & updating the database...`);
	await interaction.editReply(progress.join(`\n`));

	const ignFromDB = await Player.getIGNby({ discordID: userID });

	/** @type GuildMember */
	const guildMember = await interaction.guild.members.fetch(userID);
	const updatedPlayer = await prisma.account.update({
		where: { providerAccountId: puuid },
		data: { riotIGN: updatedIGN }
	});
	if (updatedPlayer.riotIGN !== updatedIGN) {
		progress[progress.length - 1] =
			`❌ Looks like there was an error and the database wasn't updated! Please try again later and/or let a member of the tech team know!`;
		return await interaction.editReply(progress.join(`\n`));
	}

	progress[progress.length - 1] = `✅ Updating the database to your latest IGN (\`${ignFromDB}\` -> \`${updatedIGN}\`)`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// Confirming user is managable
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Making sure I can update your roles...`);
	await interaction.editReply(progress.join(`\n`));

	// check to make sure the bot can update the user's nickname
	if (!guildMember.manageable) {
		progress[progress.length - 1] =
			`❌ The database was synced with Discord & Riot (Username: \`${discordUsername}\`, IGN: \`${updatedIGN}\`), but I can't update you in the server- I have insufficient permissions! You will need to update your roles & nickname manually!`;
		return await interaction.editReply(progress.join(`\n`));
	}

	progress[progress.length - 1] = `✅ I can update your nickname & roles!`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// Get all filtering/processing data & set flags (such as isFM (franchise management))
	// --------------------------------------------------------------------------------------------
	progress.push(`🔨 Creating filters & checking league state...`);
	await interaction.editReply(progress.join(`\n`));

	// determine if player is GM - will override the slug checks if they are, since nonplaying GMs will still receive slug & role
	const searchSelectParams = { Accounts: { where: { provider: `discord` }, select: { providerAccountId: true } } };
	const gmids = (await prisma.franchise.findMany({
		include: {
			GM: { include: searchSelectParams },
			AGM1: { include: searchSelectParams },
			AGM2: { include: searchSelectParams },
			AGM3: { include: searchSelectParams },
		}
	})).map(f => {
		return [
			f.GM?.Accounts[0].providerAccountId,
			f.AGM1?.Accounts[0].providerAccountId,
			f.AGM2?.Accounts[0].providerAccountId,
			f.AGM3?.Accounts[0].providerAccountId
		]
	}).flat().filter(v => v !== undefined);

	// determine if the player is signed
	const isFM = gmids.includes(interaction.user.id);
	const isSigned = player.team !== null;

	// determine leaguestate
	const leagueState = await ControlPanel.getLeagueState();

	progress[progress.length - 1] = `✅ The league state is \`${leagueState}\`, you **are${isFM ? `` : ` not`}** in franchise management & you **are${isSigned ? `` : ` not`}** signed!`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// Clear roles and create blank roles array to rebuild from
	// --------------------------------------------------------------------------------------------
	progress.push(`🔨 Clearing your roles & prepping to rebuild...`);
	await interaction.editReply(progress.join(`\n`));

	// get franchise role IDs to clear
	const franchiseRoleIDs = (await prisma.franchise.findMany({
		where: { active: true }
	})).map(f => f.roleID);

	await guildMember.roles.remove([
		...Object.values(ROLES.LEAGUE),
		...Object.values(ROLES.TIER),
		...franchiseRoleIDs
	]);

	let slug = null;
	let roles = [];
	let team = null;
	let franchise = null;
	let isGM = false;
	let isCaptain = false;
	let state = null;

	// currently accolades are set via whatever is currently in the nickname, but when the Accolades table is updated, this will also become a black initialization
	const accolades = guildMember.nickname?.match(emoteregex);

	progress[progress.length - 1] = `✅ Roles cleared & rebuild ready!`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// Determine correct slug (and update team from null to team object if applicable)
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Determing your team, slug, franchise & state...`);
	await interaction.editReply(progress.join(`\n`));

	const leagueStatus = player.Status.leagueStatus;
	/** @NOTE : isFM replaces isGM (to generalize Franchise Management check) and open up isGM for another check, specifically to differentiate between GM and AGM */

	if (isFM && !isSigned) { 											// NON PLAYING (A)GM
		const gmFranchiseSearchParam = {
			Accounts: { some: { providerAccountId: interaction.user.id } }
		};
		franchise = await prisma.franchise.findFirst({
			where: {
				OR: [
					{ GM: gmFranchiseSearchParam },
					{ AGM1: gmFranchiseSearchParam },
					{ AGM2: gmFranchiseSearchParam },
					{ AGM3: gmFranchiseSearchParam },
				]
			},
			include: {
				Brand: true,
				GM: { include: { Accounts: { where: { provider: `discord` } } } },
			}
		});
		slug = franchise.slug;

		// get discord account of the GM for the franchise and determine if the player updating their profile is the GM or not
		const franchiseGMDiscordID = franchise.GM.Accounts
			.find(a => a.provider == `discord`).providerAccountId;
		if (franchiseGMDiscordID == userID) isGM = true;

		state = isGM ? `NON PLAYING GM` : `NON PLAYING AGM`;
	} else if (isFM && isSigned) { 										// PLAYING (A)GM
		team = player.Team;
		franchise = player.Team.Franchise;
		slug = player.Team.Franchise.slug;

		// get discord account of the GM for the franchise and determine if the player updating their profile is the GM or not
		const franchiseGMDiscordID = franchise.GM.Accounts
			.find(a => a.provider == `discord`).providerAccountId;
		if (franchiseGMDiscordID == userID) isGM = true;

		state = isGM ? `PLAYING GM` : `PLAYING AGM`;
	} else if (isSigned) {												// SIGNED PLAYER
		team = player.Team;
		franchise = player.Team.Franchise;
		slug = player.Team.Franchise.slug;
		state = `SIGNED`;
	} else if (leagueStatus == LeagueStatus.FREE_AGENT) {				// FREE AGENT
		slug = `FA`;
		state = `FREE AGENT`;
	} else if (leagueStatus == LeagueStatus.RESTRICTED_FREE_AGENT) {	// RESTRICTED FREE AGENT
		slug = `RFA`
		state = `RESTRICTED FREE AGENT`;
	} else if (leagueStatus == LeagueStatus.DRAFT_ELIGIBLE) {			// DRAFT ELIGIBLE
		slug = `DE`;
		state = `DRAFT ELIGIBLE`;
	} else {															// VIEWER OR FORMER PLAYER
		// USER HAS NO SLUG OR TEAM.
		if (leagueStatus == LeagueStatus.RETIRED) state = `RETIRED`;
		else state = `VIEWER`;
	}

	progress[progress.length - 1] = `✅ Your team is \`${team ? team.name : null}\`, your franchise is \`${franchise ? franchise.name : null}\`, your slug is \`${slug}\` and your state is \`${state}\``;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// Checking if user is a captain
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Checking if you are a captain...`);
	await interaction.editReply(progress.join(`\n`));

	const allCaptains = (await prisma.teams.findMany({
		where: { active: true }, select: { captain: true }
	})).map(t => t.captain).filter(cid => cid !== null);

	isCaptain = allCaptains.includes(player.id);

	progress[progress.length - 1] = `✅ You **are${isCaptain ? ` ` : ` not `}**a team captain!`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// Populate roles array
	// --------------------------------------------------------------------------------------------
	progress.push(`🔨 Determining your league roles...`);
	await interaction.editReply(progress.join(`\n`));
	let readableRoles = []; // roles in plaintext to output

	// determine league roles
	if (isFM && !isSigned) { 											// NON PLAYING (A)GM
		const franchiseRole = franchise.roleID;

		roles.push(
			ROLES.LEAGUE.LEAGUE,
			franchiseRole,
			isGM ? ROLES.OPERATIONS.GM : ROLES.OPERATIONS.AGM
		);

	} else if (isFM && isSigned) { 										// PLAYING GM
		const franchiseRole = franchise.roleID;

		// push roles to array
		roles.push(
			ROLES.LEAGUE.LEAGUE,
			franchiseRole,
			isGM ? ROLES.OPERATIONS.GM : ROLES.OPERATIONS.AGM
		);

		// if the state is not combines, add tier roles
		if (leagueState !== `COMBINES`) {
			roles.push(...(await getTierRole(player, isSigned)));
		}

	} else if (isSigned) {												// SIGNED PLAYER
		const franchiseRole = franchise.roleID;

		// push roles to array
		roles.push(ROLES.LEAGUE.LEAGUE, franchiseRole);

		// if the state is not combines, add tier roles
		if (leagueState !== `COMBINES`) {
			roles.push(...(await getTierRole(player, isSigned)));
		}
	} else if (leagueStatus == LeagueStatus.FREE_AGENT) {				// FREE AGENT
		// push roles to array
		roles.push(ROLES.LEAGUE.LEAGUE, ROLES.LEAGUE.FREE_AGENT);

		// if the state is not combines, add tier roles
		if (leagueState !== `COMBINES`) {
			roles.push(...(await getTierRole(player, isSigned)));
		}
	} else if (leagueStatus == LeagueStatus.RESTRICTED_FREE_AGENT) {	// RESTRICTED FREE AGENT
		// push roles to array
		roles.push(ROLES.LEAGUE.LEAGUE, ROLES.LEAGUE.RESTRICTED_FREE_AGENT);

		// if the state is not combines, add tier roles
		if (leagueState !== `COMBINES`) {
			roles.push(...(await getTierRole(player, isSigned)));
		}
	} else if (leagueStatus == LeagueStatus.DRAFT_ELIGIBLE) {			// DRAFT ELIGIBLE
		// push roles to array
		roles.push(ROLES.LEAGUE.LEAGUE, ROLES.LEAGUE.DRAFT_ELIGIBLE);

		// if the state is not combines, add tier roles
		if (leagueState !== `COMBINES`) {
			roles.push(...(await getTierRole(player, isSigned)));
		}
	} else {															// VIEWER OR FORMER PLAYER
		if (leagueStatus == LeagueStatus.RETIRED) {
			roles.push(ROLES.LEAGUE.FORMER_PLAYER);
		} else {
			roles.push(ROLES.LEAGUE.VIEWER);
		}
	}

	if (isCaptain) {													// CAPTAIN
		roles.push(ROLES.LEAGUE.CAPTAIN);
	}

	progress[progress.length - 1] = `✅ Got your league roles!`;
	await interaction.editReply(progress.join(`\n`));

	// END LEAGUE ROLES -----------------------------------

	// determine staff roles - commenting out- this works but will need a bit more work
	// progress.push(`🔨 Checking for staff role(s)...`);
	// await interaction.editReply(progress.join(`\n`));

	// console.log(decodeRoles(player.roles));

	// progress[progress.length - 1] = `✅ Got your staff roles!`;
	// await interaction.editReply(progress.join(`\n`));

	// END STAFF ROLES ------------------------------------

	// fetch role snowflakes, if needed
	progress.push(`🔃 Fetching the roles you need from Discord...`);
	await interaction.editReply(progress.join(`\n`));

	const guild = guildMember.guild;
	for (let i = 0; i < roles.length; i++) {
		const userRole = roles[i];
		const role = guild.roles.cache.find(guildRoles => guildRoles.id == userRole) || await guild.roles.fetch(userRole);
		if (role == null) {
			progress[progress.length - 1] =
				`❌ There was a problem fetching your roles from Discord! Please try again later and/or let a member of the tech team know!`;
			return await interaction.editReply(progress.join(`\n`));
		} else readableRoles.push(role.name);
	}

	progress[progress.length - 1] = `✅ Grabbed all the roles you need! The roles you'll receive are: ${readableRoles.map(rr => `\`${rr}\``).join(`, `)}`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// update nickname
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Updating your server nickname...`);
	await interaction.editReply(progress.join(`\n`));

	const nicknameComponents = [
		slug ? `${slug} |` : null,
		gameName,
		accolades ? accolades.join(``) : null
	];
	const nickname = nicknameComponents.filter(nc => nc !== null).join(` `);

	await guildMember.setNickname(nickname);

	progress[progress.length - 1] = `✅ Your server nickname has been updated to \`${nickname}\`!`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// update roles
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Updating your server roles...`);
	await interaction.editReply(progress.join(`\n`));

	await guildMember.roles.add([...roles]);

	progress[progress.length - 1] = `✅ Your server roles have been updated!`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------	

	// update user's pfp in our db if they've changed it.
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Checking if your profile picture is valid...`);
	await interaction.editReply(progress.join(`\n`));

	const imageLookup = await fetch(player.image)
	if (!imageLookup.ok) {
		progress[progress.length - 1] = `🤔 Seems like you changed your profile picture and we missed it. We'll try to update it.`;
		await interaction.editReply(progress.join(`\n`));

		const guildMemberAvatar = guildMember.displayAvatarURL({ format: "png", dynamic: true });
		const user = await prisma.user.update({
			where: { id: player.id },
			data: { image: guildMemberAvatar },
		});

		if (user.image !== guildMemberAvatar) {
			progress[progress.length - 1] = 
				`❌ Looks like there was an error and the database wasn't updated! Please try again later and/or let a member of the tech team know!`;
		}
		else {
			updateMeilisearchPlayer(player.id)
			progress[progress.length - 1] = `✅ Your profile picture has been updated!`
		};
		await interaction.editReply(progress.join(`\n`));
	}
	// --------------------------------------------------------------------------------------------

	// lastly, update meilisearch to contain their new information
	await updateMeilisearchPlayer(player.id)

	// All done!
	// --------------------------------------------------------------------------------------------
	progress.push(`\n✅ Your profile has been updated!`);
	return await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------
}

async function getTierRole(player, isSigned) {
	const mmrEffective = player.PrimaryRiotAccount.MMR.mmrEffective;
	const tierLines = await ControlPanel.getMMRCaps(`PLAYER`);

	let roles = [];

	if ( 											// PROSPECT
		tierLines.PROSPECT.min <= mmrEffective &&
		mmrEffective <= tierLines.PROSPECT.max
	) {
		roles.push(ROLES.TIER.PROSPECT);
		if (!isSigned) roles.push(ROLES.TIER.PROSPECT_FREE_AGENT);

	} else if ( 									// APPRENCICE
		tierLines.APPRENTICE.min <= mmrEffective &&
		mmrEffective <= tierLines.APPRENTICE.max
	) {
		roles.push(ROLES.TIER.APPRENTICE);
		if (!isSigned) roles.push(ROLES.TIER.APPRENTICE_FREE_AGENT);

	} else if ( 									// EXPERT
		tierLines.EXPERT.min <= mmrEffective &&
		mmrEffective <= tierLines.EXPERT.max
	) {
		roles.push(ROLES.TIER.EXPERT);
		if (!isSigned) roles.push(ROLES.TIER.EXPERT_FREE_AGENT);

	} else if ( 									// MYTHIC
		tierLines.MYTHIC.min <= mmrEffective &&
		mmrEffective <= tierLines.MYTHIC.max
	) {
		roles.push(ROLES.TIER.MYTHIC);
		if (!isSigned) roles.push(ROLES.TIER.MYTHIC_FREE_AGENT);

	}

	return roles;
}

function decodeRoles(value) {
	let roles = [];
	for (const [key, val] of Object.entries(Roles)) {
		// Ignore reverse mappings in enums
		if (typeof val === 'number' || typeof val === 'bigint') {
			if ((BigInt(value) & BigInt(val)) !== BigInt(0)) {
				roles.push(key);
			}
		}
	}
	return roles;
}