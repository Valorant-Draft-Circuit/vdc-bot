const { GuildMember, ChatInputCommandInteraction, Message } = require(`discord.js`);
const { Player } = require(`../../../../prisma`);
const { prisma } = require("../../../../prisma/prismadb");
const { rebuildMemberProfile, loadRebuildContext } = require(`../../../helpers/profileRebuild`);


const getAccountByPuuid = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-puuid`;


async function profileUpdateServer(/** @type ChatInputCommandInteraction */ interaction) {
    await interaction.editReply({ content: `I'm on it! Updating all server members` });

    // shared lookups loaded once for the whole run instead of per member
    const context = await loadRebuildContext();

    const serverMembers = (await interaction.guild.members.fetch()).map(sm => sm);
    const memberCt = serverMembers.length;

    logger.log(`VERBOSE`, `${interaction.user} (\`${interaction.user.username}\`, \`${interaction.user.id}\`) is updating \`${memberCt}\` members`);

    let errCt = 0;
    const starttime = Date.now();
    for (let i = 0; i < memberCt; i++) {

        const percent = Math.round(((i + 1) / memberCt) * 10000) / 100;

        const timeelapsed = ((Date.now() - starttime) / 1000).toFixed(2);
        const playerMessage = await interaction.channel.send({ content: `🔃 Updating \`${serverMembers[i].user.username}\` (\`${i + 1}\`/\`${memberCt}\`) \`${percent.toString().padStart(5, ` `)}\` %  |  \`${timeelapsed}\` s...` });
        try { await update(interaction, serverMembers[i], playerMessage, context); }
        catch (e) {
            errCt++;
            logger.log(`ERROR`, `${e.name}`, e.stack);
            const latestMessage = await interaction.channel.messages.fetch(playerMessage.id)
            await latestMessage.edit({ content: `${latestMessage.content}\n> ❌ There was a problem updating \`${serverMembers[i].user.username}\`` });
        }
    }

    // lastly, mass update meilisearch
    const meilisearchResponse = await fetch(`https://${process.env.VDC_WEB_URL}/api/internal/meilisearch/documents/players?meiliauth=${process.env.MEILISEARCH_MASTER_KEY}`)
    if (!meilisearchResponse.ok) {
        logger.log(`WARNING`, `Looks like there was an error with the meilisearch document update endpoint`)
    }

    return await interaction.channel.send({ content: `✅ Hey, ${interaction.user}! I've processed \`${memberCt}\` members with \`${errCt}\` critical errors (there may be other issues with the players,as listed above). Please review the messages above.` });

}

module.exports = { profileUpdateServer };

async function update(
    /** @type {ChatInputCommandInteraction} */  interaction,
    /** @type {GuildMember}                 */  guildMember,
    /** @type {Message}                     */  playerMessage,
    context
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


    // Rebuild roles & nickname from DB state (shared helper; no per-step progress
    // callback here - one message per member keeps the bulk run within rate limits)
    // --------------------------------------------------------------------------------------------
    const rebuild = await rebuildMemberProfile(guildMember, { gameNameOverride: gameName, context });
    if (rebuild === null) {
        return await playerMessage.edit({ content: `${playerMessage.content}\n> ❌ Could not rebuild roles - no VDC/Riot account found.` });
    }
    // --------------------------------------------------------------------------------------------


    // ----- SILENT FAIL OPERATIONS -----
    // update profile picture (if changed)
    // --------------------------------------------------------------------------------------------
    const imageLookup = await fetch(player.image)
    if (!imageLookup.ok) {
        logger.log(`INFO`, `Player \`${player.name}\` (\`${player.id}\`) updated their profile picture. Attempting to update...`);

        const guildMemberAvatar = guildMember.displayAvatarURL({ format: `png`, dynamic: true, size: 2048 });
        const user = await prisma.user.update({
            where: { id: player.id },
            data: { image: guildMemberAvatar },
        });
        if (user.image !== guildMemberAvatar) {
            logger.log(`WARNING`, `Looks like there was an error updating the database for \`${player.name}\` (\`${player.id}\`)'s profile picture!`);
        }
    }

    const user = await guildMember.user.fetch();
    const guildUserBanner = user.bannerURL({ dynamic: true, size: 2048 });

    if (guildUserBanner !== player.banner) {
        logger.log(`INFO`, `Player \`${player.name}\` (\`${player.id}\`) updated their banner. Attempting to update...`);
        const user = await prisma.user.update({
            where: { id: player.id },
            data: { banner: guildUserBanner },
        });

        if (user.banner !== guildUserBanner) {
            logger.log(`WARNING`, `Looks like there was an error updating the database for \`${player.name}\` (\`${player.id}\`)'s banner!`);
        }
    }
    // --------------------------------------------------------------------------------------------


    return await playerMessage.edit({ content: `✅ Updated \`${discordUsername}\` successfully! (state: \`${rebuild.state}\`, roles: ${rebuild.readableRoles.map(rr => `\`${rr}\``).join(`, `)})` });
}
