const { LeagueStatus } = require(`@prisma/client`);
const { Player, Transaction, Flags } = require(`../../../prisma`);
const { ChatInputCommandInteraction, EmbedBuilder } = require(`discord.js`)
const fs = require(`fs`);

const { debugUser, debugLeagueStatus, forceUpdate, processInactive } = require(`../subcommands/debug`)


module.exports = {

    name: `debug`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply();

        const { _subcommand } = interaction.options;
        if (_subcommand === `user`) return debugUser(interaction);
        if (_subcommand === `report`) return debugLeagueStatus(interaction);
        if (_subcommand === `force-update`) return forceUpdate(interaction);
        if (_subcommand === `process-inactive`) return processInactive(interaction);
    }
};
