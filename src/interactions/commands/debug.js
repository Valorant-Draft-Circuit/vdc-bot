const { ChatInputCommandInteraction } = require(`discord.js`);

const { debugUser, debugLeagueStatus, forceUpdate, processInactive, updateMMR, updateByIGN, profileUpdate, refreshCache, profileUpdateServer } = require(`../subcommands/debug`);


module.exports = {

    name: `debug`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply();

        const { _subcommand } = interaction.options;
        if (_subcommand === `user`) return debugUser(interaction);
        if (_subcommand === `report`) return debugLeagueStatus(interaction);
        if (_subcommand === `force-update`) return forceUpdate(interaction);
        if (_subcommand === `process-inactive`) return processInactive(interaction);
        if (_subcommand === `update-mmr`) return updateMMR(interaction);
        if (_subcommand === `update-by-ign`) return updateByIGN(interaction);
        if (_subcommand === `profile-update`) return profileUpdate(interaction);
        if (_subcommand === `refresh-cache`) return refreshCache(interaction);
        if (_subcommand === `profile-update-server`) return profileUpdateServer(interaction);
    }
};
