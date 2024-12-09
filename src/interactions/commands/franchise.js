const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const franchises = require(`../../../cache/franchises.json`);
const { Franchise } = require("../../../prisma");
const { info, updateDescription } = require("../subcommands/franchise");
const imagepath = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/`;

module.exports = {

    name: `franchise`,

    async execute(interaction) {
        await interaction.deferReply();

        const { _subcommand } = interaction.options;

        switch (_subcommand) {
            case `info`: {
                // get info about a franchise
                return await info(interaction)
            };
            case `update-description`: {
                // update a franchise's description
                return await updateDescription.confirm(interaction)
            };
            default:
                return interaction.editReply(`That's not a valid subcommand or this command is a work in progress!`);
        }
    }
};

