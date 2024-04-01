const { LeagueStatus } = require("@prisma/client");
const { Player, Transaction, Flags } = require("../../../prisma");
const { CHANNELS, ROLES, PlayerStatusCode } = require(`../../../utils/enums`);
const { ChatInputCommandInteraction, EmbedBuilder } = require(`discord.js`)

const validStatusesToDE = [
    LeagueStatus.APPROVED, LeagueStatus.DRAFT_ELIGIBLE, LeagueStatus.FREE_AGENT, LeagueStatus.RESTRICTED_FREE_AGENT
];
const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

const rateLimitinMS = 5000;
let bulkWelcomeFlag = false;


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
                const welcomeAs = _hoistedOptions[1].value

                bulkWelcomeFlag = false;
                return await singleWelcome(interaction, { discordID: playerDiscordID, welcomeAs: welcomeAs });
            case `bulk`:
                bulkWelcomeFlag = true;
                return await bulkWelcome(interaction);
        }
    }
};

async function singleWelcome(/** @type ChatInputCommandInteraction */ interaction, welcomeParamaters) {

    const { discordID, welcomeAs } = welcomeParamaters;

    // get player information from DB and guild info (guildMember & channel)
    const playerData = await Player.getBy({ discordID: discordID });
    const guildMember = await interaction.guild.members.fetch(discordID);
    const acceptedChannel = await interaction.guild.channels.fetch(CHANNELS.ACCEPTED_MEMBERS);

    // editreply vs normal message send
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
        content: `${guildMember.user} doesn't have a player status of Pending, FA or RFA and cannot become Draft Eligible!`
    });

    // renove the viewer role & add the league role
    if (guildMember._roles.includes(ROLES.LEAGUE.VIEWER)) await guildMember.roles.remove(ROLES.LEAGUE.VIEWER);
    if (guildMember._roles.includes(ROLES.LEAGUE.FORMER_PLAYER)) await guildMember.roles.remove(ROLES.LEAGUE.FORMER_PLAYER);
    await guildMember.roles.add(ROLES.LEAGUE.LEAGUE);

    // update the name to match convention
    const ign = playerData.PrimaryRiotAccount.riotIGN.split(`#`)[0];
    const accolades = guildMember.nickname?.match(emoteregex);
    guildMember.setNickname(`${welcomeAs} | ${ign} ${accolades ? accolades.join(``) : ``}`);

    // assign the proper roles & send the correct message
    switch (welcomeAs) {
        case `DE`:
            await guildMember.roles.add(ROLES.LEAGUE.DRAFT_ELIGIBLE);
            await Transaction.updateStatus({ playerID: discordID, status: LeagueStatus.DRAFT_ELIGIBLE });
            acceptedChannel.send({
                content: `Welcome ${guildMember.user} to the league!!`
            });
            break;
        case `RFA`:
            await guildMember.roles.add(ROLES.LEAGUE.RESTRICTED_FREE_AGENT);
            await Transaction.updateStatus({ playerID: discordID, status: LeagueStatus.RESTRICTED_FREE_AGENT });
            acceptedChannel.send({
                content: `Welcome ${guildMember.user} to the league as an RFA!`
            });
            break;
        default:
            throw new Error(`INVALID STATUS VALUE. EXPECTED DE or RFA & instead got ${welcomeAs}`);
    }

    console.log(`${ign} => ${welcomeAs}`, playerData.name)

    // if it's not a bulk welcome, send a reply
    if (!bulkWelcomeFlag) return await interaction.editReply({ content: `${guildMember.user} was welcomed to the league as ${welcomeAs == `DE` ? `a` : `an`} ${welcomeAs}!` });
}

async function bulkWelcome(/** @type ChatInputCommandInteraction */ interaction) {
    const approvedPlayers = await Player.filterAllByStatus([LeagueStatus.APPROVED, LeagueStatus.DRAFT_ELIGIBLE, LeagueStatus.RESTRICTED_FREE_AGENT]);

    const playersToWelcome = approvedPlayers.map((player) => {
        const playerflags = Number(player.flags);
        const welcomeObject = { discordID: player.Accounts[0].providerAccountId }

        // Determine if the player is being welcomed as a DE or RFA
        // const welcomeAsRFA = Boolean(playerflags & Flags.REGISTERED_AS_RFA)
        const welcomeAsRFA = player.Status.leagueStatus == LeagueStatus.RESTRICTED_FREE_AGENT
        welcomeObject.welcomeAs = welcomeAsRFA ? `RFA` : `DE`;

        // return the object
        return welcomeObject;
    });

    const deCT = playersToWelcome.filter(v => v.welcomeAs === `DE`).length.toString().padStart(4, ` `);
    const rfaCT = playersToWelcome.filter(v => v.welcomeAs === `RFA`).length.toString().padStart(4, ` `);

    const embed = new EmbedBuilder({
        title: `Bulk Welcome`,
        description:
            `I'm on it! I'll be welcoming:\n` +
            `\`${deCT} \` - Draft Eligible players\n` +
            `\`${rfaCT} \` - Restricted Free Agent players\n\n` +
            `This will take about \` ${playersToWelcome.length * rateLimitinMS / 1000} \` seconds. I'll let you know when I'm done!`
        ,
        color: 0xE92929,
        footer: { text: `Valorant Draft Circuit - Welcome Players` }
    });

    let i = 0;
    const int = setInterval(async () => {
        singleWelcome(interaction, playersToWelcome[i]);
        console.log(playersToWelcome[i], i, playersToWelcome.length);

        if (i === playersToWelcome.length - 1) {
            await interaction.followUp({ content: `Hey there, ${interaction.user}, the players have been welcomed!` });
            return clearInterval(int);
        };
        i++
    }, rateLimitinMS);

    return await interaction.editReply({ embeds: [embed] });
}
