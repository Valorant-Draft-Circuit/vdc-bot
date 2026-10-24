const { ChatInputCommandInteraction } = require(`discord.js`);

const { debugUser, forceUpdate, processInactive, updateMMR, updateByIGN, profileUpdate, refreshCache, profileUpdateServer, offseasonReset, resetMapBan, activeSubs, debugGame } = require(`../subcommands/debug`);


module.exports = {

    name: `debug`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        if (subcommand === `user`) return debugUser(interaction);
        if (subcommand === `force-update`) return forceUpdate(interaction);
        if (subcommand === `process-inactive`) return processInactive(interaction);
        if (subcommand === `update-mmr`) return updateMMR(interaction);
        if (subcommand === `update-by-ign`) return updateByIGN(interaction);
        if (subcommand === `profile-update`) return profileUpdate(interaction);
        if (subcommand === `refresh-cache`) return refreshCache(interaction);
        if (subcommand === `profile-update-server`) return profileUpdateServer(interaction);
        if (subcommand === 'offseason-reset') return offseasonReset(interaction);
        if (subcommand === 'reset-mapban') return resetMapBan(interaction);
        if (subcommand === 'active-subs') return activeSubs(interaction);
        if (subcommand === 'game') return debugGame(interaction);
        }
};
