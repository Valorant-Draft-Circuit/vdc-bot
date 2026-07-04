const { GuildMember } = require(`discord.js`);
const { Player, ControlPanel } = require(`../../../prisma`);
const { LeagueStatus, ContractStatus } = require(`@prisma/client`);
const { prisma } = require(`../../../prisma/prismadb`);
const { ROLES } = require(`../../../utils/enums`);

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

/** Rebuild a member's league roles & nickname from current DB state.
 * Extracted from debug/profileUpdate.js so /mod unmute can reuse it.
 * @param {GuildMember} guildMember
 * @param {{ gameNameOverride?: string, onProgress?: (line: string) => Promise<void> }} options
 * @returns {Promise<{ state: string, slug: string|null, nickname: string, readableRoles: string[] } | null>}
 *          null when the player has no VDC account or no linked Riot account
 */
async function rebuildMemberProfile(guildMember, options = {}) {
	const { gameNameOverride, onProgress } = options;
	const progress = onProgress ?? (async () => undefined);
	const userID = guildMember.id;

	const player = await Player.getBy({ discordID: userID });
	if (!player || !player.primaryRiotAccountID) return null;

	// Get all filtering/processing data & set flags (such as isFM (franchise management))
	// --------------------------------------------------------------------------------------------
	await progress(`🔨 Creating filters & checking league state...`);

	// determine if player is GM - will override the slug checks if they are, since nonplaying GMs will still receive slug & role
	const searchSelectParams = { Accounts: { where: { provider: `discord` }, select: { providerAccountId: true } } };
	const gmids = (await prisma.franchise.findMany({
		include: {
			GM: { include: searchSelectParams },
			AGM1: { include: searchSelectParams },
			AGM2: { include: searchSelectParams },
			AGM3: { include: searchSelectParams },
			AGM4: { include: searchSelectParams },
		}
	})).map(f => {
		return [
			f.GM?.Accounts[0].providerAccountId,
			f.AGM1?.Accounts[0].providerAccountId,
			f.AGM2?.Accounts[0].providerAccountId,
			f.AGM3?.Accounts[0].providerAccountId,
			f.AGM4?.Accounts[0].providerAccountId,
		]
	}).flat().filter(v => v !== undefined);

	// determine if the player is signed
	const isFM = gmids.includes(userID);
	const isSigned = player.team !== null;

	// determine if the player is IR
	const isInactiveReserve = player.Status.contractStatus === ContractStatus.INACTIVE_RESERVE;

	// determine leaguestate
	const leagueState = await ControlPanel.getLeagueState();

	await progress(`✅ The league state is \`${leagueState}\`, \`${guildMember.user.username}\` **is${isFM ? `` : ` not`}** in franchise management & \`${guildMember.user.username}\` **is${isSigned ? `` : ` not`}** signed!`);
	// --------------------------------------------------------------------------------------------


	// Clear roles and create blank roles array to rebuild from
	// --------------------------------------------------------------------------------------------
	await progress(`🔨 Clearing \`${guildMember.user.username}\`'s roles & prepping to rebuild...`);

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

	await progress(`✅ Roles cleared & rebuild ready!`);
	// --------------------------------------------------------------------------------------------


	// Determine correct slug (and update team from null to team object if applicable)
	// --------------------------------------------------------------------------------------------
	await progress(`🔃 Determing \`${guildMember.user.username}\`'s team, slug, franchise & state...`);

	const leagueStatus = player.Status.leagueStatus;
	/** @NOTE : isFM replaces isGM (to generalize Franchise Management check) and open up isGM for another check, specifically to differentiate between GM and AGM */

	if (isFM && !isSigned) { 											// NON PLAYING (A)GM
		const gmFranchiseSearchParam = {
			Accounts: { some: { providerAccountId: userID } }
		};
		franchise = await prisma.franchise.findFirst({
			where: {
				OR: [
					{ GM: gmFranchiseSearchParam },
					{ AGM1: gmFranchiseSearchParam },
					{ AGM2: gmFranchiseSearchParam },
					{ AGM3: gmFranchiseSearchParam },
					{ AGM4: gmFranchiseSearchParam },
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
	} else if (isInactiveReserve) {										// INACTIVE RESERVE PLAYER
		team = player.Team;
		franchise = player.Team.Franchise;
		slug = player.Team.Franchise.slug;
		state = `INACTIVE RESERVE`;
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

	await progress(`✅ \`${guildMember.user.username}\`'s team is \`${team ? team.name : null}\`, their franchise is \`${franchise ? franchise.name : null}\`, their slug is \`${slug}\` and their state is \`${state}\``);
	// --------------------------------------------------------------------------------------------


	// Checking if user is a captain
	// --------------------------------------------------------------------------------------------
	await progress(`🔃 Checking if \`${guildMember.user.username}\` is a captain...`);

	const allCaptains = (await prisma.teams.findMany({
		where: { active: true }, select: { captain: true }
	})).map(t => t.captain).filter(cid => cid !== null);

	isCaptain = allCaptains.includes(player.id);

	await progress(`✅ \`${guildMember.user.username}\` **is${isCaptain ? ` ` : ` not `}**a team captain!`);
	// --------------------------------------------------------------------------------------------


	// Populate roles array
	// --------------------------------------------------------------------------------------------
	await progress(`🔨 Building \`${guildMember.user.username}\`'s roles array...`);
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

	} else if (isInactiveReserve) {										// INACTIVE RESERVE PLAYER
		const franchiseRole = franchise.roleID;

		// push roles to array
		roles.push(ROLES.LEAGUE.LEAGUE, franchiseRole, ROLES.LEAGUE.INACTIVE_RESERVE);
		readableRoles.push(`League`, franchise.name, `Inactive Reserve`);

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

	await progress(`✅ Roles array built! The roles \`${guildMember.user.username}\` will receive are: ${readableRoles.map(rr => `\`${rr}\``).join(`, `)}`);
	// --------------------------------------------------------------------------------------------


	// update nickname
	// --------------------------------------------------------------------------------------------
	await progress(`🔃 Updating \`${guildMember.user.username}\`'s server nickname...`);

	const nicknameComponents = [
		slug ? `${slug} |` : null,
		gameNameOverride ?? player.PrimaryRiotAccount.riotIGN.split(`#`)[0],
		accolades ? accolades.join(``) : null
	];
	const nickname = nicknameComponents.filter(nc => nc !== null).join(` `);

	await guildMember.setNickname(nickname);

	await progress(`✅ \`${guildMember.user.username}\`'s server nickname has been updated to \`${nickname}\`!`);
	// --------------------------------------------------------------------------------------------


	// update roles
	// --------------------------------------------------------------------------------------------
	await progress(`🔃 Updating \`${guildMember.user.username}\`'s server roles...`);

	await guildMember.roles.add([...roles]);

	await progress(`✅ \`${guildMember.user.username}\`'s server roles have been updated!`);
	// --------------------------------------------------------------------------------------------

	return { state, slug, nickname, readableRoles };
}

module.exports = { rebuildMemberProfile };

async function getTierRole(player, isSigned) {
	const mmrEffective = player.PrimaryRiotAccount.MMR.mmrEffective;
	const tierLines = await ControlPanel.getMMRCaps(`PLAYER`);

	let roles = [];
	let readableRoles = [];
	if (tierLines.RECRUIT.min <= mmrEffective &&
		mmrEffective <= tierLines.RECRUIT.max) { 	// RECRUIT
		roles.push(ROLES.TIER.RECRUIT);
		readableRoles.push(`Recruit`);
		if (!isSigned) {
			roles.push(ROLES.TIER.RECRUIT_FREE_AGENT);
			readableRoles.push(`Recruit Free Agent`);
		}
	} else if ( 									// PROSPECT
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
