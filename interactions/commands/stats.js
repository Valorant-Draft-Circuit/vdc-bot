const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, Message } = require("discord.js");

const { ButtonStyle } = require(`discord.js`)

const { TransactionsSubTypes, TransactionsCutOptions } = require(`../../utils/enums/transactions`);
const { FranchiseEmote } = require(`../../utils/enums/franchiseEmotes`);
// const { getPlayerStatsByDiscordId } = require(`../../prisma`)
const franchises = require(`../../cache/franchises.json`);
const DiscordAssets = require(`../../utils/functions/discordAssets`);


// [
//   {
//     id: 1,
//     riotId: 'S0InW_EONVQM8VuMJ4O6uJscSAONH2ashTaEexibUwqg3TsHQERYqEBu1DeC6SlcunZCPWcz8WnDZg',
//     gameID: 'b64e418a-8832-418e-adad-0b3af60ad203',
//     agent: '2',
//     rating_atk: 1.299999952316284,
//     rating_def: 1,
//     acs: 237,
//     kast: 72,
//     hs_percent: 19,
//     total_kills: 25,
//     total_deaths: 19,
//     total_assists: 7,
//     total_first_kills: 3,
//     total_first_deaths: 1,
//     total_plants: 3,
//     total_defuses: 4,
//     total_trade_deaths: 3,
//     total_trade_kills: 3,
//     total_eco_kills: 1,
//     total_antieco_kills: 4,
//     total_clutches: 0,
//     pr_kills: 0.699999988079071,
//     pr_assists: 0.2119999974966049,
//     pr_deaths: 0.8999999761581421,
//     pr_first_kills: 0.01999999955296516,
//     pr_first_deaths: 0.119999997317791,
//     pr_damage: 143.2599945068359
//   },
//   {
//     id: 2,
//     riotId: 'S0InW_EONVQM8VuMJ4O6uJscSAONH2ashTaEexibUwqg3TsHQERYqEBu1DeC6SlcunZCPWcz8WnDZg',
//     gameID: 'd4b5936c-489b-4b8f-a9af-af20290d8073',
//     agent: '2',
//     rating_atk: 2.099999904632568,
//     rating_def: 1,
//     acs: 237,
//     kast: 72,
//     hs_percent: 19,
//     total_kills: 25,
//     total_deaths: 19,
//     total_assists: 7,
//     total_first_kills: 3,
//     total_first_deaths: 1,
//     total_plants: 3,
//     total_defuses: 4,
//     total_trade_deaths: 3,
//     total_trade_kills: 3,
//     total_eco_kills: 1,
//     total_antieco_kills: 4,
//     total_clutches: 0,
//     pr_kills: 0.699999988079071,
//     pr_assists: 0.2119999974966049,
//     pr_deaths: 0.8999999761581421,
//     pr_first_kills: 0.01999999955296516,
//     pr_first_deaths: 0.119999997317791,
//     pr_damage: 143.2599945068359
//   }
// ]

// {
//     name: 'user',
//     type: 6,
//     value: '173237627955314689',
//     user: User {
//       id: '173237627955314689',
//       bot: false,
//       system: false,
//       flags: UserFlagsBitField { bitfield: 4195072 },
//       username: 'unieveth',
//       globalName: 'Unieveth',
//       discriminator: '0',
//       avatar: 'd643c62aed33ec505c3e5fb2f1806c17',
//       banner: undefined,
//       accentColor: undefined,
//       avatarDecoration: null
//     },
//     member: GuildMember {
//       guild: Guild {
//         id: '1027754353207033966',
//         name: 'Valorant Draft Circuit | Tech',
//         icon: '684c9459b53f1627a63f795f207c5f80',
//         features: [Array],
//         commands: [GuildApplicationCommandManager],
//         members: [GuildMemberManager],
//         channels: [GuildChannelManager],
//         bans: [GuildBanManager],
//         roles: [RoleManager],
//         presences: PresenceManager {},
//         voiceStates: [VoiceStateManager],
//         stageInstances: [StageInstanceManager],
//         invites: [GuildInviteManager],
//         scheduledEvents: [GuildScheduledEventManager],
//         autoModerationRules: [AutoModerationRuleManager],
//         available: true,
//         shardId: 0,
//         splash: null,
//         banner: null,
//         description: null,
//         verificationLevel: 2,
//         vanityURLCode: null,
//         nsfwLevel: 0,
//         premiumSubscriptionCount: 0,
//         discoverySplash: null,
//         memberCount: 29,
//         large: false,
//         premiumProgressBarEnabled: false,
//         applicationId: null,
//         afkTimeout: 300,
//         afkChannelId: null,
//         systemChannelId: '1057088868417011744',
//         premiumTier: 0,
//         widgetEnabled: null,
//         widgetChannelId: null,
//         explicitContentFilter: 2,
//         mfaLevel: 1,
//         joinedTimestamp: 1690065779927,
//         defaultMessageNotifications: 1,
//         systemChannelFlags: [SystemChannelFlagsBitField],
//         maximumMembers: 500000,
//         maximumPresences: null,
//         maxVideoChannelUsers: 25,
//         maxStageVideoChannelUsers: 50,
//         approximateMemberCount: null,
//         approximatePresenceCount: null,
//         vanityURLUses: null,
//         rulesChannelId: '1057167011542732861',
//         publicUpdatesChannelId: '1057089451031003147',
//         preferredLocale: 'en-US',
//         safetyAlertsChannelId: '1057089451031003147',
//         ownerId: '173237627955314689',
//         emojis: [GuildEmojiManager],
//         stickers: [GuildStickerManager]
//       },
//       joinedTimestamp: 1665106132568,
//       premiumSinceTimestamp: null,
//       nickname: 'ATO | Unieveth',
//       pending: false,
//       communicationDisabledUntilTimestamp: null,
//       user: User {
//         id: '173237627955314689',
//         bot: false,
//         system: false,
//         flags: [UserFlagsBitField],
//         username: 'unieveth',
//         globalName: 'Unieveth',
//         discriminator: '0',
//         avatar: 'd643c62aed33ec505c3e5fb2f1806c17',
//         banner: undefined,
//         accentColor: undefined,
//         avatarDecoration: null
//       },
//       avatar: null,
//       flags: GuildMemberFlagsBitField { bitfield: 0 }
//     }
// }

module.exports = {
    //https://cdn.discordapp.com/avatars/173237627955314689/d643c62aed33ec505c3e5fb2f1806c17.jpg

    name: `stats`,

    async execute(interaction) {

        const { _subcommand, _hoistedOptions } = interaction.options;
        const player = _hoistedOptions[0];
        // console.log(player)

        // const data = await getPlayerStatsByDiscordId(player.value)

        // const acs = getAverage(data.map(g => g.acs));
        // const kast = getAverage(data.map(g => g.kast));
        // const hs = getAverage(data.map(g => g.hs_percent));

        // console.log(acs, kast, hs)
        // console.log(data)
        // console.log()

        // const riotID = data[0].Player.Account.riotID

        // const stats = 
        // `\`  ACS \` : \`${String(acs).padStart(4, ' ')} \`\n`+
        // `\` KAST \` : \`${String(kast).padStart(4, ' ')} \`\n`+
        // `\` % HS \` : \`${String(hs).padStart(4, ' ')} \``;



        // // console.log(player)

        // // create the base embed
        // const embed = new EmbedBuilder({
        //     author: { 
        //         name: riotID, 
        //         iconURL: DiscordAssets.getPlayerAvatar(player.user),
        //         url: `https://tracker.gg/valorant/profile/riot/${riotID.replace(`#`, `%23`)}`
        //     },
        //     description: `Matches played: \`${data.length}\``,
        //     color: 0xE92929,
        //     fields: [
        //         {
        //             name: `\u200B`,
        //             value: stats,
        //             inline: true
        //         },
        //         {
        //             name: `\u200B`,
        //             value: `\u200B`,
        //             inline: true
        //         },
        //         {
        //             name: `\u200B`,
        //             value: stats,
        //             inline: true
        //         },
        //     ],
        //     thumbnail: { url: `https://cdn.discordapp.com/banners/963274331251671071/57044c6a68be1065a21963ee7e697f80.webp?size=480` },
        //     footer: { text: `VDC — Player Stats` }
        // });
        
        // interaction.reply({ embeds: [embed]});
    }
};

function getAverage(arr) {
    return arr.reduce((s, v) => s += v, 0) / arr.length;
}