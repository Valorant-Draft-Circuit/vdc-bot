const { LeagueStatus } = require(`@prisma/client`);
const { Player, Transaction, Flags } = require(`../../../prisma`);
const { ChatInputCommandInteraction, EmbedBuilder } = require(`discord.js`)
const fs = require(`fs`);

const { debugUser, debugLeagueStatus, forceUpdate } = require(`../subcommands/debug`)


module.exports = {

    name: `debug`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply();

        const { _subcommand } = interaction.options;
        if (_subcommand === `user`) return debugUser(interaction);
        if (_subcommand === `report`) return debugLeagueStatus(interaction);
        if (_subcommand === `force-update`) return forceUpdate(interaction);
    }
};













// const flagNames = Object.values(Flags).filter(v => typeof v == `string`);
// console.log(b.name + ` flags : ` + b.flags + `\n`)
// for (let i = 0; i < flagNames.length; i++) {
//     console.log(
//         `${flagNames[i]} :`.padStart(20, ` `),
//         Boolean(b.flags & Flags[flagNames[i]])
//     )
// }
// // ######################################################################################################

// console.log(`\n\n==============================\n\n`)


// // ROLES UNIT TESTS
// // ######################################################################################################
// const roles =
//     Roles.ADVISOR |
//     Roles.LEAD_TECH |
//     Roles.MEDIA_CASTER |
//     Roles.TECH_BOT |
//     Roles.TECH_DB;

// // const c = await Player.getRoles({ ign: `Travestey#7227` });
// const d = await Player.setRoles({ ign: `Travestey#7227` }, roles);
// // console.log(c, d)

// const roleNames = Object.values(Roles).filter(v => typeof v == `string`);

// console.log(d.name + ` roles : ` + d.roles + `\n`)
// for (let i = 0; i < roleNames.length; i++) {
//     console.log(
//         `${roleNames[i]} :`.padStart(20, ` `),
//         Boolean(d.roles & Roles[roleNames[i]])
//     )
// }