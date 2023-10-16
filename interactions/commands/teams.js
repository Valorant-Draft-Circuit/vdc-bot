const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder } = require("discord.js");

const { ButtonStyle } = require(`discord.js`)

const { TransactionsSubTypes, TransactionsCutOptions, TransactionsSignOptions } = require(`../../utils/enums/transactions`);
const { FranchiseEmote } = require(`../../utils/enums/franchiseEmotes`);
const franchises = require(`../../cache/franchises.json`);
const { Franchise } = require("../../prisma");
const imagepath = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/`;

module.exports = {

    name: `teams`,

    async execute(interaction) {
        await interaction.deferReply();


        const { _hoistedOptions } = interaction.options;
        const franchiseName = _hoistedOptions[0].value;

        const franchise = await Franchise.getBy({ name: franchiseName });
        const franchiseTeams = await Franchise.getTeams({ name: franchiseName });
        // console.log(franchiseTeams)

        const embed = new EmbedBuilder({
            // author: { name: franchiseName, iconURL: `${imagepath}${franchise.logoFileName}` },
            // title: `Valorant Draft Circuit - ${franchiseName}`,
            // description: `Valorant Draft Circuit - ${franchiseName}`,
                // `ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ`,
            fields: [
                {
                    name: `Team Name`,
                    value: franchiseTeams.map(ft => ft.name).join(`\n`),
                    inline: true
                },
                {
                    name: `Tier`,
                    // name: `ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ`,
                    value: franchiseTeams.map(ft => ft.tier).join(`\n`),
                    inline: true
                },
                {
                    name: `ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ`,
                    value: `Valorant Draft Circuit - ${franchise.name} (${franchise.slug})`,
                    inline: false
                },
            ],
            color: 0xE92929,
            thumbnail: { url: `${imagepath}${franchise.logoFileName}?size=1080` },
            // footer: { text: `Valorant Draft Circuit - ${franchiseName}ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ` }
        });

        interaction.editReply({ embeds: [embed] })
    }
};