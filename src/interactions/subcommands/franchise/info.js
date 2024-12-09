const { EmbedBuilder, ButtonStyle } = require(`discord.js`);
const { Franchise } = require(`../../../../prisma`);
const { ActionRowBuilder, ButtonBuilder } = require(`@discordjs/builders`);

const imagepath = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/`;

async function info(interaction) {

    const { _hoistedOptions } = interaction.options;
    const franchiseName = _hoistedOptions[0].value;

    const franchise = await Franchise.getBy({ name: franchiseName });
    const franchiseTeams = await Franchise.getTeams({ name: franchiseName });

    const gmIDs = [
        franchise.GM?.Accounts.find(a => a.provider == `discord`).providerAccountId,
    ].filter(v => v !== undefined);

    // somewhat sloppy way to gracefully always get every AGM
    // console.log(Object.keys(franchise).filter(k => k.includes(`AGM`)).map(k => franchise[k]).filter(k => k != undefined).map(k => k.Accounts.find(a => a.provider == `discord`).providerAccountId));

    const agmIDs = [
        franchise.AGM1?.Accounts.find(a => a.provider == `discord`).providerAccountId,
        franchise.AGM2?.Accounts.find(a => a.provider == `discord`).providerAccountId,
        franchise.AGM3?.Accounts.find(a => a.provider == `discord`).providerAccountId
    ].filter(v => v !== undefined);

    const embedAccentColor = franchise.Brand.colorPrimary ? Number(franchise.Brand.colorPrimary) : 0xE92929;

    const embed = new EmbedBuilder({
        author: { name: franchiseName, iconURL: `${imagepath}${franchise.Brand.logo}` },
        description: `**General Manager** : ${gmIDs.map(gm => `<@${gm}>`)}\n**AGMs** : ${agmIDs.map(agm => `<@${agm}>`)}`,
        fields: [
            {
                name: `\u200B`,
                value: `**Team\n**` + franchiseTeams.map(ft => ft.name).join(`\n`),
                inline: true
            },
            {
                name: `\u200B`,
                value: `**Tier\n**` + franchiseTeams.map(ft => ft.tier[0].toUpperCase() + ft.tier.substring(1).toLowerCase()).join(`\n`),
                inline: true
            },
            {
                name: `\u200B`,
                value: `\u200B`,
                inline: true
            },
        ],
        color: embedAccentColor,
        thumbnail: { url: `${imagepath}${franchise.logoFileName}?size=1080` },
        footer: { text: `Valorant Draft Circuit - ${franchise.name} (${franchise.slug})`, iconURL: `${imagepath}${franchise.Brand.logo}` }
    });

    if (franchise.Brand.description) {
        const descriptionArray = franchise.Brand.description.split(`\n`).filter(e => e !== ``);

        descriptionArray.forEach((paragraph) => {
            embed.addFields({ name: `\u200B`, value: paragraph });
        })
    }

    const replyObject = { embeds: [embed] };
    let buttons = []

    if (franchise.Brand.urlDiscord) {
        const discordButton = new ButtonBuilder({
            style: ButtonStyle.Link,
            label: `Discord`,
            url: franchise.Brand.urlDiscord
        });
        buttons.push(discordButton)
    }

    if (franchise.Brand.urlTwitter) {
        const discordButton = new ButtonBuilder({
            style: ButtonStyle.Link,
            label: `Twitter`,
            url: franchise.Brand.urlTwitter
        });
        buttons.push(discordButton)
    }

    if (buttons.length > 0) {
        const components = new ActionRowBuilder({ components: buttons });
        replyObject.components = [components];
    }


    return await interaction.editReply(replyObject);
};

module.exports = { info };