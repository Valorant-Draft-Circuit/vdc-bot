const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } = require("discord.js");

const { CHANNELS } = require("../../../../utils/enums");
const { prisma } = require("../../../../prisma/prismadb");
const imagepath = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/`;

const tierSortWeights = {
    RECRUIT: 1,
    PROSPECT: 2,
    APPRENTICE: 3,
    EXPERT: 4,
    MYTHIC: 5
};

async function refreshFranchisesChannel(/** @type ChatInputCommandInteraction */ interaction) {
    const franchiseChannel = await interaction.guild.channels.fetch(CHANNELS.FRANCHISES);

    const fetchedMessages = await franchiseChannel.messages.fetch({ limit: 100 });
    fetchedMessages.map(async (m) => await m.delete());

    const franchises = await prisma.franchise.findMany({
        where: { active: true },
        include: {
            Teams: true, Brand: true,
            GM: { include: { Accounts: true } },
            AGM1: { include: { Accounts: true } },
            AGM2: { include: { Accounts: true } },
            AGM3: { include: { Accounts: true } },
        }
    });

    const wbc = await franchiseChannel.createWebhook({
        name: 'franchisechannelupdater',
    });

    franchises.forEach(async (franchise) => {
        const gmIDs = [
            franchise.GM?.Accounts.find(a => a.provider == `discord`).providerAccountId,
        ].filter(v => v !== undefined);

        const agmIDs = [
            franchise.AGM1?.Accounts.find(a => a.provider == `discord`).providerAccountId,
            franchise.AGM2?.Accounts.find(a => a.provider == `discord`).providerAccountId,
            franchise.AGM3?.Accounts.find(a => a.provider == `discord`).providerAccountId
        ].filter(v => v !== undefined);

        const embedAccentColor = franchise.Brand.colorPrimary ? Number(franchise.Brand.colorPrimary) : 0xE92929;

        const franchiseManagement = new EmbedBuilder({
            author: { name: franchise.name, iconURL: `${imagepath}${franchise.Brand.logo}` },
            title: franchise.name,
            url: `https://vdc.gg/franchises/${franchise.slug}`,
            description: `**General Manager** : ${gmIDs.map(gm => `<@${gm}>`)}\n**AGMs** : ${agmIDs.map(agm => `<@${agm}>`)}`,
            // description: `**General Manager** : ${gmIDs.map(gm => `<@${gm}>`)}\n**AGMs** : ${agmIDs.map(agm => `<@${agm}>`)}\n${pst}`,
            // image: `${imagepath}/${franchise.Brand.logo}`,
            // fields: [
            //     {
            //         name: `\u200B`,
            //         // name: `Team Name`,
            //         value: `**Team\n**` + franchise.Teams.map(ft => ft.name).join(`\n`),
            //         inline: true
            //     },
            //     {
            //         name: `\u200B`,
            //         // name: `Tier`,
            //         value: `**Tier\n**` + franchise.Teams.map(ft => ft.tier[0].toUpperCase() + ft.tier.substring(1).toLowerCase()).join(`\n`),
            //         inline: true
            //     },
            //     {
            //         name: `\u200B`,
            //         // name: `Tier`,
            //         value: `\u200B`,
            //         inline: true
            //     },
            //     // {
            //     //     name: `\u200B`,
            //     //     value: pst,
            //     //     inline: false
            //     // },
            // ],
            color: embedAccentColor,
            // thumbnail: { url: `${imagepath}${franchise.logoFileName}?size=1080` },
            // footer: { text: `Valorant Draft Circuit - ${franchise.name} (${franchise.slug})`, iconURL: `${imagepath}${franchise.Brand.logo}` }
        });
        franchise.Teams = franchise.Teams.sort((a, b) => tierSortWeights[a.tier] - tierSortWeights[b.tier]);
        const teamsEmbed = new EmbedBuilder({
            // author: { name: franchise.name, iconURL: `${imagepath}${franchise.Brand.logo}` },
            // title: franchise.name,
            // url: `https://vdc.gg/franchises/${franchise.slug}`,
            // description: `**General Manager** : ${gmIDs.map(gm => `<@${gm}>`)}\n**AGMs** : ${agmIDs.map(agm => `<@${agm}>`)}`,
            // description: `**General Manager** : ${gmIDs.map(gm => `<@${gm}>`)}\n**AGMs** : ${agmIDs.map(agm => `<@${agm}>`)}\n${pst}`,
            // image: `${imagepath}/${franchise.Brand.logo}`,
            fields: [
                {
                    name: `\u200B`,
                    // name: `Team Name`,
                    value: `**Team\n**` + franchise.Teams.map(ft => ft.name).join(`\n`),
                    inline: true
                },
                {
                    name: `\u200B`,
                    // name: `Tier`,
                    value: `**Tier\n**` + franchise.Teams.map(ft => ft.tier[0].toUpperCase() + ft.tier.substring(1).toLowerCase()).join(`\n`),
                    inline: true
                },
                {
                    name: `\u200B`,
                    // name: `Tier`,
                    value: `\u200B`,
                    inline: true
                },
                // {
                //     name: `\u200B`,
                //     value: pst,
                //     inline: false
                // },
            ],
            color: embedAccentColor,
            // thumbnail: { url: `${imagepath}${franchise.logoFileName}?size=1080` },
            // footer: { text: `Valorant Draft Circuit - ${franchise.name} (${franchise.slug})`, iconURL: `${imagepath}${franchise.Brand.logo}` }
        });


        const descriptionEmbed = new EmbedBuilder({
            // author: { name: franchise.name, iconURL: `${imagepath}${franchise.Brand.logo}` },
            // title: franchise.name,
            // url: `https://vdc.gg/franchises/${franchise.slug}`,
            // description: `**General Manager** : ${gmIDs.map(gm => `<@${gm}>`)}\n**AGMs** : ${agmIDs.map(agm => `<@${agm}>`)}`,
            // description: `**General Manager** : ${gmIDs.map(gm => `<@${gm}>`)}\n**AGMs** : ${agmIDs.map(agm => `<@${agm}>`)}\n${pst}`,
            // image: `${imagepath}/${franchise.Brand.logo}`,
            // fields: [
            //     {
            //         name: `\u200B`,
            //         // name: `Team Name`,
            //         value: `**Team\n**` + franchise.Teams.map(ft => ft.name).join(`\n`),
            //         inline: true
            //     },
            //     {
            //         name: `\u200B`,
            //         // name: `Tier`,
            //         value: `**Tier\n**` + franchise.Teams.map(ft => ft.tier[0].toUpperCase() + ft.tier.substring(1).toLowerCase()).join(`\n`),
            //         inline: true
            //     },
            //     {
            //         name: `\u200B`,
            //         // name: `Tier`,
            //         value: `\u200B`,
            //         inline: true
            //     },
            //     // {
            //     //     name: `\u200B`,
            //     //     value: pst,
            //     //     inline: false
            //     // },
            // ],
            color: embedAccentColor,
            thumbnail: { url: `${imagepath}${franchise.logoFileName}?size=1080` },
            footer: { text: `Valorant Draft Circuit - ${franchise.name} (${franchise.slug})`, iconURL: `${imagepath}${franchise.Brand.logo}` }
        });

        if (franchise.Brand.description) {
            const descriptionArray = franchise.Brand.description.split(`\n`).filter(e => e !== ``);

            descriptionArray.forEach((paragraph) => {
                descriptionEmbed.addFields({ name: `\u200B`, value: paragraph });
            })
        }

        const replyObject = { embeds: [descriptionEmbed] };
        let buttons = []

        const websiteButton = new ButtonBuilder({
            style: ButtonStyle.Link,
            label: `Website`,
            url: `https://vdc.gg/franchises/${franchise.slug}`
        });
        buttons.push(websiteButton)


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

        let components;
        if (buttons.length > 0) {
            components = new ActionRowBuilder({ components: buttons });
            replyObject.components = [components];
        }

        // WHEN BANNERS ARE READY
        // await wbc.send({
        //     username: franchise.name,
        //     avatarURL: `${imagepath}/${franchise.Brand.logo}`,
        //     files: [{
        //         attachment: `./bin/${franchise.Brand.logo}`,
        //         name: franchise.Brand.logo
        //     }],
        // });

        await wbc.send({
            username: franchise.name,
            avatarURL: `${imagepath}/${franchise.Brand.logo}`,
            embeds: [franchiseManagement, teamsEmbed, descriptionEmbed],
            components: [components]
        });
    });
    setTimeout(() => wbc.delete(), 30000)
}

module.exports = {
    refreshFranchisesChannel: refreshFranchisesChannel
}