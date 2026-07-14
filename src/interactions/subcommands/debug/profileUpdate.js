const { GuildMember, ChatInputCommandInteraction } = require(`discord.js`);
const { Player } = require(`../../../../prisma`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { rebuildMemberProfile } = require(`../../../helpers/profileRebuild`);


const getAccountByPuuid = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-puuid`;


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


	// Rebuild roles & nickname from DB state (shared with /mod unmute)
	// --------------------------------------------------------------------------------------------
	const rebuild = await rebuildMemberProfile(guildMember, {
		gameNameOverride: gameName,
		onProgress: async (line, replacesPrevious) => {
			if (replacesPrevious) progress[progress.length - 1] = line;
			else progress.push(line);
			await interaction.editReply(progress.join(`\n`));
		},
	});

	if (rebuild === null) {
		progress.push(`❌ Could not rebuild roles - no VDC/Riot account found.`);
		return await interaction.editReply(progress.join(`\n`));
	}

	progress.push(`\n✅ \`${discordUsername}\`'s profile has been updated! (state: \`${rebuild.state}\`, nickname: \`${rebuild.nickname}\`)`);
	return await interaction.editReply(progress.join(`\n`));
}

module.exports = { profileUpdate };
