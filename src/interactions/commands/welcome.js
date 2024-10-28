const { LeagueStatus, ContractStatus } = require("@prisma/client");
const { Player, Transaction, Flags, ControlPanel } = require("../../../prisma");
const { prisma } = require("../../../prisma/prismadb");
const { CHANNELS, ROLES } = require(`../../../utils/enums`);
const { ChatInputCommandInteraction, EmbedBuilder } = require(`discord.js`)

const validStatusesToDE = [
    LeagueStatus.APPROVED, LeagueStatus.DRAFT_ELIGIBLE, LeagueStatus.FREE_AGENT, LeagueStatus.RESTRICTED_FREE_AGENT
];
const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

const rateLimitinMS = 5000;

module.exports = {

    name: `welcome`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        // defer replying to the interaction
        await interaction.deferReply();

        // destrcture options & store relevant information
        switch (interaction.options._subcommand) {
            case `single`:
                const { _hoistedOptions } = interaction.options;
                const playerDiscordID = _hoistedOptions[0].value;

                return await singleWelcome(interaction, playerDiscordID);
            case `bulk`:
                return await bulkWelcome(interaction);
        }
    }
};

async function singleWelcome(/** @type ChatInputCommandInteraction */ interaction, discordID, bulkWelcomeFlag = false) {

    // get player information from DB and guild info (guildMember & channel)
    const playerData = await Player.getBy({ discordID: discordID });
    const guildMember = await interaction.guild.members.fetch(discordID);
    const acceptedChannel = await interaction.guild.channels.fetch(CHANNELS.ACCEPTED_MEMBERS);

    // editreply vs normal message send (for bulk welcone)
    const replyFunction = (obj) => !bulkWelcomeFlag ?
        interaction.editReply(obj) :
        interaction.channel.send(obj);

    // status checks
    // check to see if the bot can perform any actions on this user (i.e. if the bot isn't high enough in role hierarchy)
    if (!guildMember.manageable) return await replyFunction({
        content: `I can't manage ${guildMember.user}- their roles are higher than mine! You will need to perform this action manually!`
    });
    if (playerData == undefined) return await replyFunction({
        content: `${guildMember.user} doesn't exist in the database!`
    });
    if (!validStatusesToDE.includes(playerData.Status.leagueStatus)) return await replyFunction({
        content: `${guildMember.user} doesn't have a player status of Approved, FA or RFA and cannot become Draft Eligible!`
    });


    // remove all league roles and then add League & franchise role
    const franchiseRoleIDs = (await prisma.franchise.findMany({ where: { active: true } })).map(f => f.roleID);
    await guildMember.roles.remove([
        ...Object.values(ROLES.LEAGUE),
        ...Object.values(ROLES.TIER),
        ...franchiseRoleIDs
    ]);

    // if MMR is allowed to be shown, set tier roles, otherwise, just silently update the database with clean rounded value
    const mmrShow = await ControlPanel.getMMRDisplayState();
    const mmrBase = Math.round(playerData.PrimaryRiotAccount.MMR.mmrBase);

    await prisma.user.update({
        where: { id: playerData.id },
        data: {
            PrimaryRiotAccount: { update: { data: { MMR: { update: { data: { mmrEffective: mmrBase } } } } } },
        }
    });

    if (mmrShow) {
        const tierLines = await ControlPanel.getMMRCaps(`PLAYER`);
        switch (true) {
            case (tierLines.PROSPECT.min < mmrBase && mmrBase < tierLines.PROSPECT.max):
                await guildMember.roles.add([ROLES.TIER.PROSPECT, ROLES.TIER.PROSPECT_FREE_AGENT]); 
                break;
            case tierLines.APPRENTICE.min < mmrBase && mmrBase < tierLines.APPRENTICE.max:
                await guildMember.roles.add([ROLES.TIER.APPRENTICE, ROLES.TIER.APPRENTICE_FREE_AGENT]);
                break;
            case tierLines.EXPERT.min < mmrBase && mmrBase < tierLines.EXPERT.max:
                await guildMember.roles.add([ROLES.TIER.EXPERT, ROLES.TIER.EXPERT_FREE_AGENT]);
                break;
            case tierLines.MYTHIC.min < mmrBase && mmrBase < tierLines.MYTHIC.max:
                await guildMember.roles.add([ROLES.TIER.MYTHIC, ROLES.TIER.MYTHIC_FREE_AGENT]);
                break;
        }
    }

    // initalize welcome slug
    let welcomeSlug = ``;

    if (playerData.Status.contractStatus == ContractStatus.SIGNED) {
        // get team and if captain
        const playerTeam = playerData.Team;
        const isCaptain = playerTeam.captain == playerData.id;

        // get franchise and if GM
        const playerFranchise = playerTeam.Franchise;
        const franchiseRoleID = playerFranchise.roleID;
        const isGM = [playerFranchise.gmID, playerFranchise.agm1ID, playerFranchise.agm2ID].filter(id => id != null).includes(playerData.id);

        // set welcomeslug
        welcomeSlug = playerFranchise.slug;

        if (playerData.Status.contractRemaining === 1) {
            // continuing with franchise with 1 season remaining on contract
            await acceptedChannel.send({
                content: `Welcome ${guildMember.user} back to the league on their team, ${playerTeam.name} on ${playerTeam.Franchise.name}!`
            });

        } else if (playerData.Status.contractRemaining === 0) {
            // expiring contract
            await acceptedChannel.send({
                content: `Welcome ${guildMember.user} back to the league as they renegotiate their contract with ${playerTeam.Franchise.name}!`
            });

        } else {
            // somethign broke
            return await replyFunction({
                content: `WARNING: PLAYER ${guildMember} HAS INVALID CONTRACT STATUS!`
            });
        }
        await guildMember.roles.add(isCaptain ? [franchiseRoleID, ROLES.LEAGUE.CAPTAIN] : franchiseRoleID);
        await Transaction.updateStatus({ playerID: discordID, status: isGM ? LeagueStatus.GENERAL_MANAGER : LeagueStatus.SIGNED });

        // FAs, RFAs and DEs
    } else {
        const playerFlags = Number(playerData.flags);

        if (playerFlags & Flags.REGISTERED_AS_RFA) {
            // RFA
            welcomeSlug = `RFA`;
            await guildMember.roles.add(ROLES.LEAGUE.RESTRICTED_FREE_AGENT);
            await Transaction.updateStatus({ playerID: discordID, status: LeagueStatus.RESTRICTED_FREE_AGENT });
            await acceptedChannel.send({
                content: `Welcome ${guildMember.user} to the league as a Restricted Free Agent!`
            });

        } else if (playerFlags & Flags.ACTIVE_LAST_SEASON) {
            // FREE AGENT
            welcomeSlug = `FA`;
            await guildMember.roles.add(ROLES.LEAGUE.FREE_AGENT);
            await Transaction.updateStatus({ playerID: discordID, status: LeagueStatus.FREE_AGENT });
            await acceptedChannel.send({
                content: `Welcome ${guildMember.user} back to the league as a Free Agent!`
            });
        } else {
            // all falls through
            welcomeSlug = `DE`;
            await guildMember.roles.add(ROLES.LEAGUE.DRAFT_ELIGIBLE);
            await Transaction.updateStatus({ playerID: discordID, status: LeagueStatus.DRAFT_ELIGIBLE });
            await acceptedChannel.send({
                content: `Welcome ${guildMember.user} to the league!`
            });
        }
    }

    // everyone gets the league role
    await guildMember.roles.add(ROLES.LEAGUE.LEAGUE);


    // update the name to match convention
    const ign = playerData.PrimaryRiotAccount.riotIGN.split(`#`)[0];
    const accolades = guildMember.nickname?.match(emoteregex);
    guildMember.setNickname(`${welcomeSlug} | ${ign} ${accolades ? accolades.join(``) : ``}`);


    // log player and where they get updated
    console.log(`${playerData.name} => ${welcomeSlug} | ${ign}`);

    // if it's not a bulk welcome, send a reply
    if (!bulkWelcomeFlag) return await interaction.editReply({ content: `${guildMember.user} was welcomed to the league!` });
    else return;
}

async function bulkWelcome(/** @type ChatInputCommandInteraction */ interaction) {
    const approvedPlayers = await Player.filterAllByStatus([LeagueStatus.APPROVED]);

    const playersToWelcome = approvedPlayers.map(p => {
        return p.Accounts.find((a) => a.provider == `discord`).providerAccountId;
    });

    const embed = new EmbedBuilder({
        title: `Bulk Welcome`,
        description:
            `I'm on it! I'll be welcoming: \`${playersToWelcome.length} \` players to the league!\n` +
            `This will take about \` ${playersToWelcome.length * rateLimitinMS / 1000} \` seconds. I'll let you know when I'm done!`
        ,
        color: 0xE92929,
        footer: { text: `Valorant Draft Circuit - Welcome Players` }
    });

    let i = 0;
    const int = setInterval(async () => {
        singleWelcome(interaction, playersToWelcome[i], true);
        console.log(`${playersToWelcome[i]}, ${i}/${playersToWelcome.length}`);

        if (i === playersToWelcome.length - 1) {
            await interaction.followUp({ content: `Hey there, ${interaction.user}, the players have been welcomed to the league!` });
            return clearInterval(int);
        };
        i++
    }, rateLimitinMS);

    return await interaction.editReply({ embeds: [embed] });
}
