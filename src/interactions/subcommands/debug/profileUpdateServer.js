const { GuildMember, ChatInputCommandInteraction, Message } = require(`discord.js`);
const { Player, ControlPanel } = require(`../../../../prisma`);
const { LeagueStatus } = require("@prisma/client");
const { prisma } = require("../../../../prisma/prismadb");
const { ROLES } = require("../../../../utils/enums");


let leagueState = null;
let allCaptains = null;
let gmids = null;
let franchiseRoleIDs = null;

const getAccountByPuuid = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-puuid`;
const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;


async function profileUpdateServer(/** @type ChatInputCommandInteraction */ interaction) {
    await interaction.editReply({ content: `I'm on it! Updating all server members` });

    // SHARED DATABSE CALLS ###############################
    leagueState = await ControlPanel.getLeagueState();

    allCaptains = (await prisma.teams.findMany({
        where: { active: true }, select: { captain: true }
    })).map(t => t.captain).filter(cid => cid !== null);

    const searchSelectParams = { Accounts: { where: { provider: `discord` }, select: { providerAccountId: true } } };
    gmids = (await prisma.franchise.findMany({
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

    franchiseRoleIDs = (await prisma.franchise.findMany({
        where: { active: true }
    })).map(f => f.roleID);
    // #####################################################

    const serverMembers = (await interaction.guild.members.fetch()).map(sm => sm);
    const memberCt = serverMembers.length;

    logger.log(`VERBOSE`, `${interaction.user} (\`${interaction.user.username}\`, \`${interaction.user.id}\`) is updating \`${memberCt}\` members`);

    // const initialMessage = await interaction.channel.send({ content: `[\` ${``.padStart(`0`, `█`).padEnd(100, ` `)} \`] (\`${0 + 1}\`/\`${memberCt}\`) \`${`0`.padStart(5, ` `)}\` %  |  \`0\` s` });
    // initialMessage.pin();

    // because of discord message update limit (500 as of 4/25/25) set max update ct
    // const msgUpdateLimit = 250;

    // const updFreq = 10;
    // const maxUpdateCt = Math.floor(memberCt / updFreq);

    let errCt = 0;
    const starttime = Date.now();
    for (let i = 0; i < memberCt; i++) {

        const percent = Math.round(((i + 1) / memberCt) * 10000) / 100;

        // discord has a message update limit of 500, so only update every so often
        // if (i % updFreq === 0 || i === memberCt - 1) {
        //     const timeelapsed = ((Date.now() - starttime) / 1000).toFixed(2);
        //     await initialMessage.edit({ content: `[\` ${``.padStart(Math.round(percent), `█`).padEnd(100, ` `)} \`] (\`${i + 1}\`/\`${memberCt}\`) \`${percent.toString().padStart(5, ` `)}\` %  |  \`${timeelapsed}\` s` });
        // }
        // NVM killing the progess bar I'll use it later. I'll just add progress to the individual messages

        const timeelapsed = ((Date.now() - starttime) / 1000).toFixed(2);
        const playerMessage = await interaction.channel.send({ content: `🔃 Updating \`${serverMembers[i].user.username}\` (\`${i + 1}\`/\`${memberCt}\`) \`${percent.toString().padStart(5, ` `)}\` %  |  \`${timeelapsed}\` s...` });
        try { await update(interaction, serverMembers[i], playerMessage); }
        catch (e) {
            errCt++;
            logger.log(`ERROR`, `${e.name}`, e.stack);
            const latestMessage = await interaction.channel.messages.fetch(playerMessage.id)
            await latestMessage.edit({ content: `${latestMessage.content}\n> ❌ There was a problem updating \`${serverMembers[i].user.username}\`` });
        }
    }

    return await interaction.channel.send({ content: `✅ Hey, ${interaction.user}! I've processed \`${memberCt}\` members with \`${errCt}\` critical errors (there may be other issues with the players,as listed above). Please review the messages above.` });

}

module.exports = { profileUpdateServer };

async function update(
    /** @type {ChatInputCommandInteraction} */  interaction,
    /** @type {GuildMember}                 */  guildMember,
    /** @type {Message}                     */  playerMessage
) {
    const userID = guildMember.id;
    const discordUsername = guildMember.user.username;

    // Check our database
    // --------------------------------------------------------------------------------------------
    const player = await Player.getBy({ discordID: userID });
    if (!player) {
        return await playerMessage.edit({ content: `${playerMessage.content}\n> ❌ It doesn't look like ${guildMember} (\`${discordUsername}\`, \`${guildMember.id}\`) has an account with VDC- I can't find them in our database!` });
    }

    if (!player.primaryRiotAccountID) {
        return await playerMessage.edit({ content: `${playerMessage.content}\n> ❌ I looked through our database and I don't see \`${discordUsername}\`'s Riot account linked anywhere! Please have them link one [here](https://vdc.gg/me)!` });
    }
    // --------------------------------------------------------------------------------------------

    // Update database to current discord username
    // --------------------------------------------------------------------------------------------
    // get the player's current discord username
    const updatedUsername = await prisma.user.update({
        where: { id: player.id },
        data: { name: discordUsername },
    });
    if (updatedUsername.name !== discordUsername) {
        return await playerMessage.edit({ content: `${playerMessage.content}\n> ❌ Looks like there was an error and we weren't able to sync \`${discordUsername}\`'s Discord username! Please try again later and/or let a member of the tech team know!` });
    }
    // --------------------------------------------------------------------------------------------

    // Get most recent riotIGN from Riot
    // --------------------------------------------------------------------------------------------
    // get the player's updated IGN from Riot's accountByPuuid endpoint
    const puuid = player.primaryRiotAccountID;
    const response = await fetch(`${getAccountByPuuid}/${puuid}?api_key=${process.env.VDC_API_KEY}`);
    if (!response.ok) {
        return await playerMessage.edit({ content: `${playerMessage.content}\n> ❌ There was a problem checking Riot's API for account \`${discordUsername}\`! Please try again later and/or let a member of the tech team know!` });
    }

    const { gameName, tagLine } = await response.json();
    const updatedIGN = `${gameName}#${tagLine}`;
    // --------------------------------------------------------------------------------------------


    // For each alt account, update the database
    // --------------------------------------------------------------------------------------------
    // get the total number of alts the user has
    const altAccounts = player.Accounts.filter(a => a.provider == `riot` && a.providerAccountId !== puuid);

    if (altAccounts.length == 0) {				// NO ALTS
        // do nothing
    } else {									// ALTS
        // iterate through each alt 
        for (let i = 0; i < altAccounts.length; i++) {
            const altAccount = altAccounts[i];

            // get the alt's updated IGN from Riot's accountByPuuid endpoint
            const puuid = altAccount.providerAccountId;
            const response = await fetch(`${getAccountByPuuid}/${puuid}?api_key=${process.env.VDC_API_KEY}`);
            if (!response.ok) {
                return await playerMessage.edit({ content: `${playerMessage.content}\n> ❌ There was a problem checking Riot's API for account \`${discordUsername}\`! Please try again later and/or let a member of the tech team know!` });
            }

            const { gameName, tagLine } = await response.json();
            const updatedAltIGN = `${gameName}#${tagLine}`;

            // update the database
            const updatedAltAccount = await prisma.account.update({
                where: { providerAccountId: puuid },
                data: { riotIGN: updatedAltIGN }
            });

            if (updatedAltAccount.riotIGN !== updatedAltIGN) {
                return await playerMessage.edit({ content: `${playerMessage.content}\n> ❌ Looks like there was an error and we weren't able to sync \`${discordUsername}\`'s alt account! Please try again later and/or let a member of the tech team know!` });
            }
        }
    }
    // --------------------------------------------------------------------------------------------


    // Get our current info about the player & update the database to the most recent ign
    // --------------------------------------------------------------------------------------------
    const updatedPlayer = await prisma.account.update({
        where: { providerAccountId: puuid },
        data: { riotIGN: updatedIGN }
    });
    if (updatedPlayer.riotIGN !== updatedIGN) {
        return await playerMessage.edit({ content: `${playerMessage.content}\n> ❌ Looks like there was an error and we weren't able to save \`${discordUsername}\`'s IGN to the database! Please try again later and/or let a member of the tech team know!` });
    }
    // --------------------------------------------------------------------------------------------


    // Confirming user is managable
    // --------------------------------------------------------------------------------------------
    // check to make sure the bot can update the user's nickname
    if (!guildMember.manageable) {
        return await playerMessage.edit({ content: `${playerMessage.content}\n> ❌ I don't have sufficient permissions to manage \`${discordUsername}\`!` });
    }
    // --------------------------------------------------------------------------------------------


    // Get all filtering/processing data & set flags (such as isFM (franchise management))
    // --------------------------------------------------------------------------------------------
    // determine if player is GM - will override the slug checks if they are, since nonplaying GMs will still receive slug & role

    // determine if the player is signed
    const isFM = gmids.includes(guildMember.id);
    const isSigned = player.team !== null;
    // --------------------------------------------------------------------------------------------


    // Clear roles and create blank roles array to rebuild from
    // --------------------------------------------------------------------------------------------
    // get franchise role IDs to clear

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
    // --------------------------------------------------------------------------------------------


    // Determine correct slug (and update team from null to team object if applicable)
    // --------------------------------------------------------------------------------------------
    const leagueStatus = player.Status.leagueStatus;
    /** @NOTE : isFM replaces isGM (to generalize Franchise Management check) and open up isGM for another check, specifically to differentiate between GM and AGM */

    if (isFM && !isSigned) { 											// NON PLAYING (A)GM
        const gmFranchiseSearchParam = {
            Accounts: { some: { providerAccountId: guildMember.id } }
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
    // --------------------------------------------------------------------------------------------


    // Checking if user is a captain
    // --------------------------------------------------------------------------------------------
    isCaptain = allCaptains.includes(player.id);
    // --------------------------------------------------------------------------------------------


    // Populate roles array
    // --------------------------------------------------------------------------------------------
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

    const guild = guildMember.guild;
    for (let i = 0; i < roles.length; i++) {
        const userRole = roles[i];
        const role = guild.roles.cache.find(guildRoles => guildRoles.id == userRole) || await guild.roles.fetch(userRole);
        if (role == null) {
            return await playerMessage.edit({ content: `${playerMessage.content}\n> ❌ Looks like there was an error and I wasn't able to find the role \`${userRole}\`! Please try again later and/or let a member of the tech team know!` });
        } else readableRoles.push(role.name);
    }
    // --------------------------------------------------------------------------------------------


    // update nickname
    // --------------------------------------------------------------------------------------------
    const nicknameComponents = [
        slug ? `${slug} |` : null,
        gameName,
        accolades ? accolades.join(``) : null
    ];
    const nickname = nicknameComponents.filter(nc => nc !== null).join(` `);

    await guildMember.setNickname(nickname);
    // --------------------------------------------------------------------------------------------

    // update roles
    // --------------------------------------------------------------------------------------------
    await guildMember.roles.add([...roles]);
    // --------------------------------------------------------------------------------------------
    return await playerMessage.edit({ content: `✅ Updated \`${discordUsername}\` successfully!` });
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