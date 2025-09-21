const { ChatInputCommandInteraction, Message, EmbedBuilder } = require(`discord.js`);
const { Player, ControlPanel } = require("../../../prisma");
const { prisma } = require("../../../prisma/prismadb");
const { GameType, Tier } = require("@prisma/client");

const defs = {
    WIN: {
        readable: `Winner`, emote: `🏆`, title: `Grand Finals Winner`,
        description: `This player was part of the championship roster that qualified for, and then won playoffs`
    },
    WIN_FM: {
        readable: `Franchise Management`, emote: `👑`, title: `Franchise Management for a Winning Grand Finals Team`,
        description: `This player was a part of the franchise management for the team that qualified for, and then won playoffs`
    },
    WIN_SUB: {
        readable: `Substitute`, emote: `🥈`, title: `Substitute for a Player in a Grand Finals Match`,
        description: `This player substituted for a player on an existing roster that won playoffs`
    },
    AST: {
        readable: `All Star`, emote: `⭐`, title: `All Star`,
        description: `This player was nominated by the Numbers Committee as a top 10 player in their tier`
    },
    MVP: {
        readable: `MVP`, emote: `🏅`, title: `Most Valuable Player`,
        description: `This player was nominated as the most valuable player in their tier`
    },
}

// this is needed to correctly sort the tiers
const tierSortWeights = {
    RECRUIT: 1,
    PROSPECT: 2,
    APPRENTICE: 3,
    EXPERT: 4,
    MYTHIC: 5
};




module.exports = {

    name: `historybooks`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();

        if (subcommand == `player`) return await historyPlayer(interaction);
        if (subcommand == `season`) return await historySeason(interaction);
        else return await historyUI(interaction);
    }
};

async function historyPlayer(/** @type ChatInputCommandInteraction */ interaction) {
    const user = interaction.options.getUser(`user`);
    // await interaction.reply(`You want to view the history books for ${user.tag}!`);

    const season = await ControlPanel.getSeason();
    const player = await Player.getBy({ discordID: user.id });

    const accolades = (await prisma.accolades.findMany({ where: { userID: player.id } })).sort((a, b) => tierSortWeights[a.tier] - tierSortWeights[b.tier]);
    console.log(accolades)

    // const player = (await prisma.user.findFirst({
    //     where: { Accounts: { some: { providerAccountId: user.id } } },
    //     select: {
    //         // PrimaryRiotAccount: { include: { MMR: true } },
    //         // Accounts: { include: { MMR: true } },
    //         // Status: true,
    //         // Team: {
    //         //     include: {
    //         //         Franchise: {
    //         //             include: {
    //         //                 Brand: true,
    //         //                 GM: { include: { Accounts: true } },
    //         //                 AGM1: { include: { Accounts: true } },
    //         //                 AGM2: { include: { Accounts: true } },
    //         //                 AGM3: { include: { Accounts: true } },
    //         //             }
    //         //         }
    //         //     }
    //         // },
    //         Accolades: true,
    //         // Records: true,
    //         // Captain: true,

    //     }
    // })).Accolades.sort((a, b) => tierSortWeights[a.tier] - tierSortWeights[b.tier]).sort((a, b) => a.shorthand.localeCompare(b.shorthand));
    const games = await prisma.games.findMany({ where: { PlayerStats: { some: { userID: player.id } } } });

    const accoladesObject = {};
    for (let i = 0; i < accolades.length; i++) {
        const accolade = accolades[i];
        if (accoladesObject[accolade.shorthand] == undefined) {
            accoladesObject[accolade.shorthand] = { shorthand: accolade.shorthand, emote: defs[accolade.shorthand].emote, total: 1, accolades: [accolade] }
        }
        else {
            accoladesObject[accolade.shorthand][`total`]++;
            accoladesObject[accolade.shorthand][`accolades`] = [...accoladesObject[accolade.shorthand].accolades, accolade];
        };
    }

    const embeds = [new EmbedBuilder({
        author: { name: `History Books: ${player.PrimaryRiotAccount.riotIGN}`, icon_url: user.avatarURL() },
        description: `Below is a list of all the accolades ${user} ([\`${player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(player.PrimaryRiotAccount)}`})) has earned in the league, as well as information about their history.\n\n-# *Note: Some of this information is incorrect, because we no longer have access to verbose data stored prior to Season 6. Data from S6 onwards will be fully accurate.*`,
        color: 0x235A81,
        fields: [
            { name: `Total Accolades`, value: `\`\`\`js\n${accolades.length}\`\`\``, inline: true },
            { name: `Combines Played`, value: `\`\`\`js\n${games.filter(m => m.gameType == GameType.COMBINE).length}\`\`\``, inline: true },
            { name: `Games Played`, value: `\`\`\`js\n${games.filter(m => m.gameType == GameType.SEASON).length}\`\`\``, inline: true },
            { name: `Season ${season} Combines Played`, value: `\`\`\`js\n${games.filter(m => m.gameType == GameType.COMBINE && m.season == season).length}\`\`\``, inline: true },
            { name: `Season ${season} Games Played`, value: `\`\`\`js\n${games.filter(m => m.gameType == GameType.SEASON && m.season == season).length}\`\`\``, inline: true },
        ],
        // footer: { text: `*` }
    })];

    const uniqueAccolades = Object.keys(accoladesObject);
    for (let i = 0; i < uniqueAccolades.length; i++) {

        const uniqueAccolade = accoladesObject[uniqueAccolades[i]];
        const embed = new EmbedBuilder({
            title: defs[uniqueAccolade.shorthand].title,
            description: `-# ${uniqueAccolade.emote} : ${defs[uniqueAccolade.shorthand].description}`,
            color: 0x235A81
        });

        const accoladeArray = uniqueAccolade.accolades;
        let accoladeStringArray = [];
        for (let j = 0; j < accoladeArray.length; j++) {
            const accolade = accoladeArray[j];
            accoladeStringArray.push(`${accolade.tier[0].toUpperCase() + accolade.tier.substring(1).toLowerCase()} - Season ${accolade.season}`);
        }

        // add the accolades to the embed and then push it to the embeds array
        embed.addFields({ name: `\u200B`, value: `**__Tier & Season Won__**\n${accoladeStringArray.join(`\n`)}` });
        embeds.push(embed)
    }

    return await interaction.editReply({ embeds: embeds });
}
async function historySeason(/** @type ChatInputCommandInteraction */ interaction) {
    const season = interaction.options.getNumber(`season`);

    const accolades = await prisma.accolades.findMany({ where: { season: season }, include: { Player: { include: { Accounts: true, PrimaryRiotAccount: true } } } });
    if (accolades.length == 0) return await interaction.editReply(`There are no accolades for season ${season}!`);




    // Team Champions
    const mChampion = accolades.filter(m => m.tier == Tier.MYTHIC && m.shorthand == `WIN`);
    const eChampion = accolades.filter(m => m.tier == Tier.EXPERT && m.shorthand == `WIN`);
    const aChampion = accolades.filter(m => m.tier == Tier.APPRENTICE && m.shorthand == `WIN`);
    const pChampion = accolades.filter(m => m.tier == Tier.PROSPECT && m.shorthand == `WIN`);
    const rChampion = accolades.filter(m => m.tier == Tier.RECRUIT && m.shorthand == `WIN`);

    // FM Creator of Champions
    const mManagement = accolades.filter(m => m.tier == Tier.MYTHIC && m.shorthand == `WIN_FM`);
    const eManagement = accolades.filter(m => m.tier == Tier.EXPERT && m.shorthand == `WIN_FM`);
    const aManagement = accolades.filter(m => m.tier == Tier.APPRENTICE && m.shorthand == `WIN_FM`);
    const pManagement = accolades.filter(m => m.tier == Tier.PROSPECT && m.shorthand == `WIN_FM`);
    const rManagement = accolades.filter(m => m.tier == Tier.RECRUIT && m.shorthand == `WIN_FM`);

    // Finals Substitutes
    const mSubstitute = accolades.filter(m => m.tier == Tier.MYTHIC && m.shorthand == `WIN_SUB`);
    const eSubstitute = accolades.filter(m => m.tier == Tier.EXPERT && m.shorthand == `WIN_SUB`);
    const aSubstitute = accolades.filter(m => m.tier == Tier.APPRENTICE && m.shorthand == `WIN_SUB`);
    const pSubstitute = accolades.filter(m => m.tier == Tier.PROSPECT && m.shorthand == `WIN_SUB`);
    const rSubstitute = accolades.filter(m => m.tier == Tier.RECRUIT && m.shorthand == `WIN_SUB`);

    // all stars
    const mAllStar = accolades.filter(m => m.tier == Tier.MYTHIC && m.shorthand == `AST`);
    const eAllStar = accolades.filter(m => m.tier == Tier.EXPERT && m.shorthand == `AST`);
    const aAllStar = accolades.filter(m => m.tier == Tier.APPRENTICE && m.shorthand == `AST`);
    const pAllStar = accolades.filter(m => m.tier == Tier.PROSPECT && m.shorthand == `AST`);
    const rAllStar = accolades.filter(m => m.tier == Tier.RECRUIT && m.shorthand == `AST`);

    // recruit
    const rFields = [
        { name: `Recruit`, value: rChampion.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        { name: `Recruit Franchise Management`, value: rManagement.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
    ];
    if (rSubstitute.length !== 0) rFields.push({ name: `Recruit Substitutes`, value: rSubstitute.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true });
    else rFields.push({ name: `\u200B`, value: `\u200B`, inline: true });

    // prospect
    const pFields = [
        { name: `Prospect`, value: pChampion.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        { name: `Prospect Franchise Management`, value: pManagement.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
    ];
    if (pSubstitute.length !== 0) pFields.push({ name: `Prospect Substitutes`, value: pSubstitute.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true });
    else pFields.push({ name: `\u200B`, value: `\u200B`, inline: true });


    //apprentice
    const aFields = [
        { name: `Apprentice`, value: aChampion.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
                { name: `Apprentice Franchise Management`, value: aManagement.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
    ];
    if (aSubstitute.length !== 0) aFields.push({ name: `Apprentice Substitutes`, value: aSubstitute.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true });
    else aFields.push({ name: `\u200B`, value: `\u200B`, inline: true });

    //expert
    const eFields = [
        { name: `Expert`, value: eChampion.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        { name: `Expert Franchise Management`, value: eManagement.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
    ];
    if (eSubstitute.length !== 0) eFields.push({ name: `Expert Substitutes`, value: eSubstitute.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true });
    else eFields.push({ name: `\u200B`, value: `\u200B`, inline: true });


    //mythic
    const mFields = [
        { name: `Mythic`, value: mChampion.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        { name: `Mythic Franchise Management`, value: mManagement.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
    ];
    if (mSubstitute.length !== 0) mFields.push({ name: `Mythic Substitutes`, value: mSubstitute.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true });
    else mFields.push({ name: `\u200B`, value: `\u200B`, inline: true });





    console.log()

    const embeds = [
        new EmbedBuilder({
            author: { name: `History Books: Season ${season}` },
            color: 0x235A81,
            fields: [
                // { name: `Apprentice All Stars`, value: aAllStar.map(ast => `<@${ast.Player.Accounts.find(a => a.provider === `discord`).providerAccountId}> ([\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
                ...rFields,
                
                ...pFields,

                ...aFields,

                ...eFields,

                ...mFields,

                // { name: `Expert Season ${season} Champions`, value: eChampion.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
                // { name: `Expert Season ${season} Franchise Management`, value: eManagement.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
                // { name: `Expert Season ${season} Substitutes`, value: eSubstitute.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },

                // { name: `Mythic Season ${season} Champions`, value: mChampion.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
                // { name: `Mythic Season ${season} Franchise Management`, value: mManagement.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
                // { name: `Mythic Season ${season} Substitutes`, value: mSubstitute.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
            ],
            // footer: { text: `*` }
        }),
        // new EmbedBuilder({
        //     author: { name: `History Books: Season ${season}` },
        //     color: 0x235A81,
        //     fields: [
        //         // { name: `Apprentice All Stars`, value: aAllStar.map(ast => `<@${ast.Player.Accounts.find(a => a.provider === `discord`).providerAccountId}> ([\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        //         { name: `Prospect Season ${season} Champions`, value: pChampion.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        //         { name: `Prospect Season ${season} Franchise Management`, value: pManagement.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        //         { name: `Prospect Season ${season} Substitutes`, value: pSubstitute.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        //     ],
        //     // footer: { text: `*` }
        // }),
        // new EmbedBuilder({
        //     author: { name: `History Books: Season ${season}` },
        //     color: 0x235A81,
        //     fields: [
        //         { name: `Apprentice Season ${season} Champions`, value: aChampion.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        //         { name: `Apprentice Season ${season} Franchise Management`, value: aManagement.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        //         { name: `Apprentice Season ${season} Substitutes`, value: aSubstitute.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        //     ],
        //     // footer: { text: `*` }
        // }),
        // new EmbedBuilder({
        //     author: { name: `History Books: Season ${season}` },
        //     color: 0x235A81,
        //     fields: [
        //         { name: `Expert Season ${season} Champions`, value: eChampion.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        //         { name: `Expert Season ${season} Franchise Management`, value: eManagement.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        //         { name: `Expert Season ${season} Substitutes`, value: eSubstitute.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        //     ],
        //     // footer: { text: `*` }
        // }),
        // new EmbedBuilder({
        //     author: { name: `History Books: Season ${season}` },
        //     color: 0x235A81,
        //     fields: [
        //         { name: `Mythic Season ${season} Champions`, value: mChampion.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        //         { name: `Mythic Season ${season} Franchise Management`, value: mManagement.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        //         { name: `Mythic Season ${season} Substitutes`, value: mSubstitute.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
        //     ],
        //     // footer: { text: `*` }
        // }),
        new EmbedBuilder({
            color: 0x235A81,
            fields: [
                { name: `Recruit All Stars`, value: rAllStar.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
                { name: `Prospect All Stars`, value: pAllStar.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
                { name: `\u200B`, value: `\u200B`, inline: true },
                { name: `Apprentice All Stars`, value: aAllStar.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
                { name: `Expert All Stars`, value: eAllStar.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },
                { name: `\u200B`, value: `\u200B`, inline: true },
                { name: `Mythic All Stars`, value: mAllStar.map(ast => `[\`${ast.Player.PrimaryRiotAccount.riotIGN}\`](${`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ast.Player.PrimaryRiotAccount)}`})`).join(`\n`), inline: true },

            ],
        }),
        // new EmbedBuilder({
        //     color: 0x235A81,
        //     fields: [
        //     ],
        // })
    ]

    for (let i = 0; i < embeds.length; i++) {
        const embed = embeds[i];
        await interaction.channel.send({ embeds: [embed] });
    }

    await interaction.editReply({ content: `Sent!` });
    return await interaction.deleteReply();

    // console.log(accolades)
}