const { LeagueStatus, Tier, ContractStatus } = require(`@prisma/client`);

const { ControlPanel, Transaction } = require(`../../../../prisma`);
const { EmbedBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { CHANNELS, ROLES } = require(`../../../../utils/enums`);

const COLORS = {
    PROSPECT: 0xFEC335,
    APPRENTICE: 0x72C357,
    EXPERT: 0x04AEE4,
    MYTHIC: 0xA657A6,
}

const Logger = require(`../../../core/logger`);
const logger = new Logger();

const imagepath = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/`;
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
                    Brand: true, Teams: true,
                    GM: { include: { Accounts: true } },
                    AGM1: { include: { Accounts: true } },
                    AGM2: { include: { Accounts: true } },
                    AGM3: { include: { Accounts: true } },
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
        const isNewContract = player.Status.contractStatus !== ContractStatus.SIGNED
        await Transaction.draftSign({ userID: player.id, teamID: team.id, isGM: isGM, isNewContract: isNewContract });

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

        // Attempt to send a message to the user once they are cut
        try {
            const gmIDs = [
                franchise.GM?.Accounts.find(a => a.provider == `discord`).providerAccountId,
            ].filter(v => v !== undefined);

            const agmIDs = [
                franchise.AGM1?.Accounts.find(a => a.provider == `discord`).providerAccountId,
                franchise.AGM2?.Accounts.find(a => a.provider == `discord`).providerAccountId,
                franchise.AGM3?.Accounts.find(a => a.provider == `discord`).providerAccountId
            ].filter(v => v !== undefined);

            const dmEmbed = new EmbedBuilder({
                description: `Congratulations, you've been drafted to ${franchise.name}'s **${team.tier}** team, ${team.name}! Make sure you join the franchise server using the link below- best of luck to you and your new team!\n\n Your new GM is ${gmIDs.map(gm => `<@${gm}>`)} & AGM(s) are ${agmIDs.map(agm => `<@${agm}>`)}. Feel free to reach out to them if you have any more questions!`,
                thumbnail: { url: `${imagepath}${franchise.Brand.logo}` },
                color: Number(franchise.Brand.colorPrimary)
            });

            // create the action row and add the button to it
            const dmRow = new ActionRowBuilder({
                components: [
                    new ButtonBuilder({
                        label: `${franchise.name} Discord`,
                        style: ButtonStyle.Link,
                        url: franchise.Brand.urlDiscord
                    })
                ]
            });
            await guildMember.send({ embeds: [dmEmbed], components: [dmRow] });

        } catch (e) {
            logger.log(`WARNING`, `User ${player.name} does not have DMs open & will not receive the drafted message`);
        }

        // send the update
        await transactionsChannel.send({ embeds: [pickEmbed] });
        console.log(`REL: R: ${draftPick.round}, P: ${draftPick.pick}, ${playerIGN}`)
    };

    /** Callback function to update the embed once the entire queue is finished processing */
    const finishProcessingMessage = async () => {
        return setTimeout(async () => {
            const embed = (await interaction.fetchReply()).embeds[0];
            const debugEmbed = new EmbedBuilder(embed);

            debugEmbed.setDescription(`The season ${season} ${tier} draft has been released!`);

            const tierEndEmbed = new EmbedBuilder({
                author: { name: `The Season ${season} ${tier} Draft has concluded!` },
                color: COLORS[tier]
            })

            await transactionsChannel.send({ embeds: [tierEndEmbed] });
            await interaction.editReply({ embeds: [debugEmbed] });
        }, releaseInterval * 3);
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
