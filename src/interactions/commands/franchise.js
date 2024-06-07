const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const franchises = require(`../../../cache/franchises.json`);
const { Franchise } = require("../../../prisma");
const imagepath = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/`;

module.exports = {

    name: `franchise`,

    async execute(interaction) {
        await interaction.deferReply();


        const { _hoistedOptions } = interaction.options;
        const franchiseName = _hoistedOptions[0].value;

        const franchise = await Franchise.getBy({ name: franchiseName });
        const franchiseTeams = await Franchise.getTeams({ name: franchiseName });
        // console.log(franchiseTeams)

        const gmIDs = [
            franchise.GM?.Accounts.find(a => a.provider == `discord`).providerAccountId,
        ].filter(v => v !== undefined);

        const agmIDs = [
            franchise.AGM1?.Accounts.find(a => a.provider == `discord`).providerAccountId,
            franchise.AGM2?.Accounts.find(a => a.provider == `discord`).providerAccountId
        ].filter(v => v !== undefined);

        // const gm = franchise.GM.name;
        // const agmsArray = [franchise.AGM1?.name, franchise.AGM2?.name].filter(agm => agm !== undefined)
        // const agms = agmsArray.length === 0 ? `N/A` : agmsArray.join(`, `)
        const embedAccentColor = franchise.Brand.colorPrimary ? Number(franchise.Brand.colorPrimary) : 0xE92929;
        const pst = ``.padStart(22, `＿`)
        // console.log(pst)

        const embed = new EmbedBuilder({
            author: { name: franchiseName, iconURL: `${imagepath}${franchise.Brand.logo}` },
            // title: franchise.name,
            description: `**General Manager** : ${gmIDs.map(gm => `<@${gm}>`)}\n**AGMs** : ${agmIDs.map(agm => `<@${agm}>`)}`,
            // description: `**General Manager** : ${gmIDs.map(gm => `<@${gm}>`)}\n**AGMs** : ${agmIDs.map(agm => `<@${agm}>`)}\n${pst}`,
            fields: [
                {
                    name: `\u200B`,
                    // name: `Team Name`,
                    value: `**Team\n**` + franchiseTeams.map(ft => ft.name).join(`\n`),
                    inline: true
                },
                {
                    name: `\u200B`,
                    // name: `Tier`,
                    value: `**Tier\n**` + franchiseTeams.map(ft => ft.tier[0].toUpperCase() + ft.tier.substring(1).toLowerCase()).join(`\n`),
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
    }
};