/** @enum {Number} Pull the enums from ApplicationCommandOptionType
 * @option Subcommand
 * @option SubcommandGroup
 * @option String
 * @option Integer
 * @option Boolean,
 * @option User
 * @option Channel
 * @option Role
 * @option Mentionable
 * @option Number
 * @option Attachment
 */
const { ApplicationCommandOptionType } = require(`discord.js`);

module.exports = {
    name: 'mapbans',
    description: 'Run mapbans',
    // options: [
    //     {
    //         name: 'unlinked',
    //         description: 'Perform mapbans without referencing & linking to the database.',
    //         type: ApplicationCommandOptionType.Boolean,
    //         required: false
    //     },
    //     {
    //         name: `team`,
    //         description: `The team you'd like to perform unlinked mapbans with`,
    //         type: ApplicationCommandOptionType.String,
    //         required: false,
    //         autocomplete: true
    //     },
    //     {
    //         name: `player`,
    //         description: `The player you'd like to perform unlinked mapbans with`,
    //         type: ApplicationCommandOptionType.String,
    //         required: false,
    //     }
    // ]
}