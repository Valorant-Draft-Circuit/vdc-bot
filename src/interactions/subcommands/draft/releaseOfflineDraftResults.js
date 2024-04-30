const { LeagueStatus, Tier } = require("@prisma/client");

const { ControlPanel, Transaction } = require("../../../../prisma");
const { EmbedBuilder, ChatInputCommandInteraction } = require("discord.js");
const { prisma } = require("../../../../prisma/prismadb");
const { CHANNELS, ROLES } = require("../../../../utils/enums");

const COLORS = {
    PROSPECT: 0xFEC335,
    APPRENTICE: 0x72C357,
    EXPERT: 0x04AEE4,
    MYTHIC: 0xA657A6,
}

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
const releaseInterval = 5 * 1000; // in ms


async function releaseOfflineDraftResults(/** @type ChatInputCommandInteraction */ interaction, /** @type Tier */ tier) {
    const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
    const season = await ControlPanel.getSeason();
    const draftBoard = (await prisma.draft.findMany({
        where: { AND: [{ season: season }, { tier: tier }, { userID: { not: null } }] },
        include: {
            Franchise: {
                include: {
                    Brand: true, Teams: true, GM: { include: { Accounts: true } }
                }
            },
            Player: { include: { PrimaryRiotAccount: true, Accounts: true, Status: true } }
        }
    }))
        .sort((a, b) => a.pick - b.pick)
        .sort((a, b) => a.round - b.round);

    // get all franchise role IDs
    const franchiseRoleIDs = (await prisma.franchise.findMany({ where: { active: true } })).map(f => f.roleID);
    // ##################################################################################################
    // ##################################################################################################

    /** Callback function to sign the user to the franchise */
    const executeSign = async (/** @type draftBoard[0] */ draftPick) => {
        // get the data for team, player accounts & GM accounts
        const player = draftPick.Player;
        const franchise = draftPick.Franchise;
        const team = franchise.Teams.find(t => t.tier === tier);
        const playerDiscordID = player.Accounts.find(a => a.provider === `discord`).providerAccountId;
        const playerIGN = player.PrimaryRiotAccount.riotIGN;
        const gmDiscordAccount = draftPick.Franchise.GM.Accounts.find(a => a.provider === `discord`);

        // update nickname
        const playerTag = playerIGN.split(`#`)[0];
        let guildMember;
        try {
            guildMember = await interaction.guild.members.fetch(playerDiscordID);
        } catch (error) {
            console.log(`There was an error fetching ${player.name} (${playerIGN})`)
        }

        // checks to make sure the bot doesn't crash lmfao
        if (guildMember == undefined) {
            interaction.channel.send(`There was an error grabbing <@${playerDiscordID}> (\`${player.name}\`, \`${playerIGN}\`). Maybe they're not in the server?`)
        } else if (!guildMember.manageable) {
            interaction.channel.send(`I can't manage the roles or update the nickname for <@${playerDiscordID}> (\`${player.name}\`, \`${playerIGN}\`). Their roles are higher than mine!`)
        } else {
            const accolades = guildMember.nickname?.match(emoteregex);
            guildMember.setNickname(`${franchise.slug} | ${playerTag} ${accolades ? accolades.join(``) : ``}`);

            await guildMember.roles.remove([
                ...Object.values(ROLES.LEAGUE),
                ...Object.values(ROLES.TIER),
                ...franchiseRoleIDs
            ]);
            await guildMember.roles.add([
                ROLES.LEAGUE.LEAGUE,
                ROLES.TIER[tier],
                franchise.roleID
            ]);
        }

        // sign the player in the db
        const isGM = player.Status.leagueStatus === LeagueStatus.GENERAL_MANAGER;
        await Transaction.sign({ userID: player.id, teamID: team.id, isGM: isGM });

        // create the embed
        const pickEmbed = new EmbedBuilder({
            author: { name: `${tier}  |  ${draftPick.round == 99 ? `Keeper` : `Round ${draftPick.round}  |  Pick: ${draftPick.pick}`}` },
            color: COLORS[tier],
            thumbnail: { url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${draftPick.Franchise.Brand.logo}` },
            description: `${team.name} ${draftPick.keeper ? `keep` : `draft`} <@${playerDiscordID}> (${player.name})`,
            fields: [
                { name: `IGN`, value: `[${playerIGN}](https://tracker.gg/valorant/profile/riot/${encodeURIComponent(playerIGN)})`, inline: true },
                { name: `Franchise`, value: draftPick.Franchise.name, inline: true },
                { name: `GM`, value: `<@${gmDiscordAccount.providerAccountId}>`, inline: true },
            ],
            timestamp: Date.now(),
            footer: { text: `Valorant Draft Circuit Draft` }
        })

        // send the update
        await transactionsChannel.send({ embeds: [pickEmbed] });
        console.log(`REL: R: ${draftPick.round}, P: ${draftPick.pick}, ${playerIGN}`)
    };

    /** Callback function to update the embed once the entire queue is finished processing */
    const finishProcessingMessage = async () => {
        const embed = (await interaction.fetchReply()).embeds[0];
        const debugEmbed = new EmbedBuilder(embed);

        debugEmbed.setDescription(`The season ${season} ${tier} draft has been released!`);

        const tierEndEmbed = new EmbedBuilder({
            author: { name: `The Season ${season} ${tier} Draft has concluded!` },
            color: COLORS[tier]
        })

        await transactionsChannel.send({ embeds: [tierEndEmbed] });
        return await interaction.editReply({ embeds: [debugEmbed] });
    }

    // ##################################################################################################
    // ##################################################################################################

    const tierBeginEmbed = new EmbedBuilder({
        author: { name: `The Season ${season} ${tier} Draft is beginning!` },
        color: COLORS[tier]
    })
    await transactionsChannel.send({ embeds: [tierBeginEmbed] });

    // begin processing the queue
    processQueue(draftBoard, releaseInterval, executeSign, finishProcessingMessage);


    // update the embed with the expected runtime & remove all the components
    const expectedRuntime = Math.round((releaseInterval * draftBoard.length / 10)) / 100;
    const debugEmbed = new EmbedBuilder({
        color: COLORS[tier],
        description: `Releasing the season ${season} ${tier} offline draft results. This operation should take approximately ${expectedRuntime} second(s).`
    });
    return await interaction.editReply({ embeds: [debugEmbed] });
}


/** Function to process an array of items at a set interval (in ms) with a function to execute on each array index
 * @param {Array} arr Array to iterate though and process
 * @param {Number} queueInterval Interval to process the queue at (in ms)
 * @param {Function} intervalCallback Callback function to execute every <queueInterval> ms with an index of <arr> as the argument
 * @param {Function} endIntervalQueueCallback Callback function to execute once the queue is finished processing
 */
async function processQueue(arr, queueInterval, intervalCallback, endIntervalQueueCallback) {
    let index = 0;

    const endQueueProcessing = async (intervalID) => {
        clearInterval(intervalID);
        return await endIntervalQueueCallback();
    };

    const intervalID = setInterval(async () => {
        intervalCallback(arr[index]);
        index++

        if (arr[index] === undefined) return endQueueProcessing(intervalID);
    }, queueInterval);
}

module.exports = { releaseOfflineDraftResults }
