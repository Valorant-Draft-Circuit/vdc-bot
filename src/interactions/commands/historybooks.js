const { ChatInputCommandInteraction, Message, EmbedBuilder } = require(`discord.js`);
const { Player } = require("../../../prisma");
const { prisma } = require("../../../prisma/prismadb");

const defs = {
    WIN: { readable: `Winner`, emote: `🏆`, title: `some title`, description: `` },
    WIN_FM: { readable: `Franchise Management`, emote: `👑`, title: ``, description: `` },
    WIN_SUB: { readable: `Substitute`, emote: `🥈`, title: ``, description: `` },
    AST: { readable: `All Star`, emote: `⭐`, title: ``, description: `` },
    MVP: { readable: `MVP`, emote: `🏅`, title: ``, description: `` },
}

// this is needed to correctly sort the tiers
const tierSortWeights = {
    PROSPECT: 1,
    APPRENTICE: 2,
    EXPERT: 3,
    MYTHIC: 4
};




module.exports = {

    name: `historybooks`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {

        const subcommand = interaction.options.getSubcommand();

        if (subcommand == `player`) return await historyPlayer(interaction);
        else return await historyUI(interaction);
    }
};

async function historyPlayer(interaction) {
    const user = interaction.options.getUser(`user`);
    // await interaction.reply(`You want to view the history books for ${user.tag}!`);

    const player = (await prisma.user.findFirst({
        where: { Accounts: { some: { providerAccountId: user.id } } },
        select: {
            // PrimaryRiotAccount: { include: { MMR: true } },
            // Accounts: { include: { MMR: true } },
            // Status: true,
            // Team: {
            //     include: {
            //         Franchise: {
            //             include: {
            //                 Brand: true,
            //                 GM: { include: { Accounts: true } },
            //                 AGM1: { include: { Accounts: true } },
            //                 AGM2: { include: { Accounts: true } },
            //                 AGM3: { include: { Accounts: true } },
            //             }
            //         }
            //     }
            // },
            Accolades: true,
            // Records: true,
            // Captain: true,

        }
    })).Accolades.sort((a, b) => tierSortWeights[a.tier] - tierSortWeights[b.tier]).sort((a, b) => a.shorthand.localeCompare(b.shorthand));

    // console.log(player)

    const accoladesObject = {};
    for (let i = 0; i < player.length; i++) {
        const accolade = player[i];
        if (accoladesObject[accolade.shorthand] == undefined) accoladesObject[accolade.shorthand] = {total: 1, accolades: [accolade], emote: defs[accolade.shorthand].emote};
        else {
            accoladesObject[accolade.shorthand][`total`]++;
            accoladesObject[accolade.shorthand][`accolades`] = [...accoladesObject[accolade.shorthand].accolades, accolade];
        };
    }

    console.log(accoladesObject);








    let readables = [];
    const embeds = [];

    for (let i = 0; i < Object.keys(accoladesObject).length; i++) {
        const element = accoladesObject[i];

        // initialize the embed
        const embed = new EmbedBuilder({
            title: ``,
            color: 0x235A81
        });
        console.log(element)
    }










    for (let i = 0; i < player.length; i++) {
        const accolade = player[i];
        // embeds.push(new EmbedBuilder({
        //     title: `${defs[accolade.shorthand].emote} : ${accolade.tier[0].toUpperCase() + accolade.tier.substring(1).toLowerCase()} ${defs[accolade.shorthand].readable} for Season ${accolade.season}`,
        //     color: 0x235A81
        // }));

        readables.push(`${defs[accolade.shorthand].emote} : ${accolade.tier[0].toUpperCase() + accolade.tier.substring(1).toLowerCase()} ${defs[accolade.shorthand].readable} for Season ${accolade.season}`);
    }

    interaction.reply(readables.join(`\n`));
}
async function historyUI(interaction) { }