const { EmbedBuilder, GuildMember, ChatInputCommandInteraction } = require(`discord.js`);
const { Player, Franchise, ControlPanel } = require(`../../../../prisma`);
// const { prisma } = require(`../../../prisma`);
const { LeagueStatus, ContractStatus } = require("@prisma/client");
// const { StatusEmotes, ROLES } = require("../../../utils/enums");
const { prisma } = require("../../../../prisma/prismadb");
const { ROLES } = require("../../../../utils/enums");


const getAccountByPuuid = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-puuid`;
const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;


async function profileUpdate(/** @type ChatInputCommandInteraction */ interaction) {
	const userID = interaction.options._hoistedOptions[0].value;

	/** @type GuildMember */
	const guildMember = await interaction.guild.members.fetch(userID);

	// get the player's current discord username
	const discordUsername = guildMember.user.username;

	let progress = []

	// Check our database
	// --------------------------------------------------------------------------------------------
	progress.push(`🔍 Searching the VDC database for \`${discordUsername}\` & their accounts...`);
	await interaction.editReply(progress.join(`\n`));

	const player = await Player.getBy({ discordID: userID });
	if (!player.primaryRiotAccountID) {
		progress[progress.length - 1] =
			`❌ I looked through our database and I don't see \`${discordUsername}\`'s Riot account linked anywhere! Please have them link one [here](https://vdc.gg/me)!`;
		return await interaction.editReply(progress.join(`\n`));
	}

	progress[progress.length - 1] = `✅ Found user \`${player.PrimaryRiotAccount.riotIGN}\`!`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------

	// Update database to current discord username
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Syncing \`${discordUsername}\`'s Discord username...`);
	await interaction.editReply(progress.join(`\n`));

	const updatedUsername = await prisma.user.update({
		where: { id: player.id },
		data: { name: discordUsername },
	});
	if (updatedUsername.name !== discordUsername) {
		progress[progress.length - 1] =
			`❌ Looks like there was an error and we weren't able to sync \`${discordUsername}\`'s Discord username! Please try again later and/or let a member of the tech team know!`;
		return await interaction.editReply(progress.join(`\n`));
	}

	progress[progress.length - 1] = `✅ Synced \`${discordUsername}\`'s Discord username (\`${discordUsername}\` -> \`${updatedUsername.name}\`)`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------

	// Get most recent riotIGN from Riot
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Fetching \`${discordUsername}\`'s current Riot IGN from Riot's servers...`);
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
	progress.push(`🔍 Looking for \`${discordUsername}\`'s alt accounts...`);
	await interaction.editReply(progress.join(`\n`));

	// get the total number of alts the user has
	const altAccounts = player.Accounts.filter(a => a.provider == `riot` && a.providerAccountId !== puuid);

	if (altAccounts.length == 0) {				// NO ALTS
		progress[progress.length - 1] = `✅ \`${discordUsername}\` has no alt accounts registered with VDC!`;
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
	progress.push(`🔃 Getting \`${discordUsername}\`'s current information & updating the database...`);
	await interaction.editReply(progress.join(`\n`));

	const ignFromDB = await Player.getIGNby({ discordID: userID });

	const updatedPlayer = await prisma.account.update({
		where: { providerAccountId: puuid },
		data: { riotIGN: updatedIGN }
	});
	if (updatedPlayer.riotIGN !== updatedIGN) {
		progress[progress.length - 1] =
			`❌ Looks like there was an error and the database wasn't updated! Please try again later and/or let a member of the tech team know!`;
		return await interaction.editReply(progress.join(`\n`));
	}

	progress[progress.length - 1] = `✅ Updating the database to \`${discordUsername}\`'s latest IGN (\`${ignFromDB}\` -> \`${updatedIGN}\`)`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// Confirming user is managable
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Making sure I can update \`${discordUsername}\`'s roles...`);
	await interaction.editReply(progress.join(`\n`));

	// check to make sure the bot can update the user's nickname
	if (!guildMember.manageable) {
		progress[progress.length - 1] =
			`❌ The database was synced with Discord & Riot (Username: \`${discordUsername}\`, IGN: \`${updatedIGN}\`), but I can't update \`${discordUsername}\` in the server- I have insufficient permissions! You will need to update \`${discordUsername}\`'s roles & nickname manually!`;
		return await interaction.editReply(progress.join(`\n`));
	}

	progress[progress.length - 1] = `✅ I can update \`${discordUsername}\`'s nickname & roles!`;
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
	const isFM = gmids.includes(guildMember.user.id);
	const isSigned = player.team !== null;

	// determine leaguestate
	const leagueState = await ControlPanel.getLeagueState();

	progress[progress.length - 1] = `✅ The league state is \`${leagueState}\`, \`${discordUsername}\` **is${isFM ? `` : ` not`}** in franchise management & \`${discordUsername}\` **is${isSigned ? `` : ` not`}** signed!`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// Clear roles and create blank roles array to rebuild from
	// --------------------------------------------------------------------------------------------
	progress.push(`🔨 Clearing \`${discordUsername}\`'s roles & prepping to rebuild...`);
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
	progress.push(`🔃 Determing \`${discordUsername}\`'s team, slug, franchise & state...`);
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

	progress[progress.length - 1] = `✅ \`${discordUsername}\`'s team is \`${team ? team.name : null}\`, their franchise is \`${franchise ? franchise.name : null}\`, your slug is \`${slug}\` and their state is \`${state}\``;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// Checking if user is a captain
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Checking if \`${discordUsername}\` is a captain...`);
	await interaction.editReply(progress.join(`\n`));

	const allCaptains = (await prisma.teams.findMany({
		where: { active: true }, select: { captain: true }
	})).map(t => t.captain).filter(cid => cid !== null);

	isCaptain = allCaptains.includes(player.id);

	progress[progress.length - 1] = `✅ \`${discordUsername}\` **is${isCaptain ? ` ` : ` not `}**a team captain!`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// Populate roles array
	// --------------------------------------------------------------------------------------------
	progress.push(`🔨 Building \`${discordUsername}\`'s roles array...`);
	await interaction.editReply(progress.join(`\n`));
	let readableRoles = []; // roles in plaintext to output

	if (isFM && !isSigned) { 											// NON PLAYING (A)GM
		const franchiseRole = franchise.roleID;

		roles.push(
			ROLES.LEAGUE.LEAGUE,
			franchiseRole,
			isGM ? ROLES.OPERATIONS.GM : ROLES.OPERATIONS.AGM
		);
		readableRoles.push(
			`League`,
			franchise.name,
			isGM ? `General Manager` : `Assistant General Manager`
		);

	} else if (isFM && isSigned) { 										// PLAYING GM
		const franchiseRole = franchise.roleID;

		// push roles to array
		roles.push(
			ROLES.LEAGUE.LEAGUE,
			franchiseRole,
			isGM ? ROLES.OPERATIONS.GM : ROLES.OPERATIONS.AGM
		);
		readableRoles.push(
			`League`,
			franchise.name,
			isGM ? `General Manager` : `Assistant General Manager`
		);

		// if the state is not combines, add tier roles
		if (leagueState !== `COMBINES`) {
			const tierroleResponse = await getTierRole(player, isSigned);
			roles.push(...tierroleResponse.roles);
			readableRoles.push(...tierroleResponse.readableRoles);
		}

	} else if (isSigned) {												// SIGNED PLAYER
		const franchiseRole = franchise.roleID;

		// push roles to array
		roles.push(ROLES.LEAGUE.LEAGUE, franchiseRole);
		readableRoles.push(`League`, franchise.name);

		// if the state is not combines, add tier roles
		if (leagueState !== `COMBINES`) {
			const tierroleResponse = await getTierRole(player, isSigned);
			roles.push(...tierroleResponse.roles);
			readableRoles.push(...tierroleResponse.readableRoles);
		}
	} else if (leagueStatus == LeagueStatus.FREE_AGENT) {				// FREE AGENT
		// push roles to array
		roles.push(ROLES.LEAGUE.LEAGUE, ROLES.LEAGUE.FREE_AGENT);
		readableRoles.push(`League`, `Free Agent`);

		// if the state is not combines, add tier roles
		if (leagueState !== `COMBINES`) {
			const tierroleResponse = await getTierRole(player, isSigned);
			roles.push(...tierroleResponse.roles);
			readableRoles.push(...tierroleResponse.readableRoles);
		}
	} else if (leagueStatus == LeagueStatus.RESTRICTED_FREE_AGENT) {	// RESTRICTED FREE AGENT
		// push roles to array
		roles.push(ROLES.LEAGUE.LEAGUE, ROLES.LEAGUE.RESTRICTED_FREE_AGENT);
		readableRoles.push(`League`, `Restricted Free Agent`);

		// if the state is not combines, add tier roles
		if (leagueState !== `COMBINES`) {
			const tierroleResponse = await getTierRole(player, isSigned);
			roles.push(...tierroleResponse.roles);
			readableRoles.push(...tierroleResponse.readableRoles);
		}
	} else if (leagueStatus == LeagueStatus.DRAFT_ELIGIBLE) {			// DRAFT ELIGIBLE
		// push roles to array
		roles.push(ROLES.LEAGUE.LEAGUE, ROLES.LEAGUE.DRAFT_ELIGIBLE);
		readableRoles.push(`League`, `Draft Eligible`);

		// if the state is not combines, add tier roles
		if (leagueState !== `COMBINES`) {
			const tierroleResponse = await getTierRole(player, isSigned);
			roles.push(...tierroleResponse.roles);
			readableRoles.push(...tierroleResponse.readableRoles);
		}
	} else {															// VIEWER OR FORMER PLAYER
		if (leagueStatus == LeagueStatus.RETIRED) {
			roles.push(ROLES.LEAGUE.FORMER_PLAYER);
			readableRoles.push(`Former Player`);
		} else {
			roles.push(ROLES.LEAGUE.VIEWER);
			readableRoles.push(`Viewer`);
		}
	}

	if (isCaptain) {													// CAPTAIN
		roles.push(ROLES.LEAGUE.CAPTAIN);
		readableRoles.push(`Captain`);
	}

	progress[progress.length - 1] = `✅ Roles array built! The roles \`${discordUsername}\` will receive are: ${readableRoles.map(rr => `\`${rr}\``).join(`, `)}`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// update nickname
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Updating \`${discordUsername}\`'s server nickname...`);
	await interaction.editReply(progress.join(`\n`));

	const nicknameComponents = [
		slug ? `${slug} |` : null,
		gameName,
		accolades ? accolades.join(``) : null
	];
	const nickname = nicknameComponents.filter(nc => nc !== null).join(` `);

	await guildMember.setNickname(nickname);

	progress[progress.length - 1] = `✅ \`${discordUsername}\`'s server nickname has been updated to \`${nickname}\`!`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// update roles
	// --------------------------------------------------------------------------------------------
	progress.push(`🔃 Updating \`${discordUsername}\`'s server roles...`);
	await interaction.editReply(progress.join(`\n`));

	await guildMember.roles.add([...roles]);

	progress[progress.length - 1] = `✅ \`${discordUsername}\`'s server roles have been updated!`;
	await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------


	// All done!
	// --------------------------------------------------------------------------------------------
	progress.push(`\n✅ \`${discordUsername}\`'s profile has been updated!`);
	return await interaction.editReply(progress.join(`\n`));
	// --------------------------------------------------------------------------------------------
}

module.exports = { profileUpdate };

async function getTierRole(player, isSigned) {
	const mmrEffective = player.PrimaryRiotAccount.MMR.mmrEffective;
	const tierLines = await ControlPanel.getMMRCaps(`PLAYER`);

	let roles = [];
	let readableRoles = [];

	if ( 											// PROSPECT
		tierLines.PROSPECT.min <= mmrEffective &&
		mmrEffective <= tierLines.PROSPECT.max
	) {
		roles.push(ROLES.TIER.PROSPECT);
		readableRoles.push(`Prospect`);

		if (!isSigned) {
			roles.push(ROLES.TIER.PROSPECT_FREE_AGENT);
			readableRoles.push(`Prospect Free Agent`);
		}
	} else if ( 									// APPRENCICE
		tierLines.APPRENTICE.min <= mmrEffective &&
		mmrEffective <= tierLines.APPRENTICE.max
	) {
		roles.push(ROLES.TIER.APPRENTICE);
		readableRoles.push(`Apprentice`);

		if (!isSigned) {
			roles.push(ROLES.TIER.APPRENTICE_FREE_AGENT);
			readableRoles.push(`Apprentice Free Agent`);
		}
	} else if ( 									// EXPERT
		tierLines.EXPERT.min <= mmrEffective &&
		mmrEffective <= tierLines.EXPERT.max
	) {
		roles.push(ROLES.TIER.EXPERT);
		readableRoles.push(`Expert`);

		if (!isSigned) {
			roles.push(ROLES.TIER.EXPERT_FREE_AGENT);
			readableRoles.push(`Expert Free Agent`);
		}
	} else if ( 									// MYTHIC
		tierLines.MYTHIC.min <= mmrEffective &&
		mmrEffective <= tierLines.MYTHIC.max
	) {
		roles.push(ROLES.TIER.MYTHIC);
		readableRoles.push(`Mythic`);

		if (!isSigned) {
			roles.push(ROLES.TIER.MYTHIC_FREE_AGENT);
			readableRoles.push(`Mythic Free Agent`);
		}
	}

	return {
		roles: roles,
		readableRoles: readableRoles
	};
}