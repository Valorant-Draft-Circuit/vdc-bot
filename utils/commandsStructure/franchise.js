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
    name: `franchise`,
    description: `Get info about a franchise`,
    options: [
        {
            name: `franchise`,
            description: `The franchise to get teams for`,
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: franchiseChoices()
        }
    ]
}

function franchiseChoices() {
    const franchiseData = require(`../../cache/franchises.json`);
    const franchiseOptions = [];

    franchiseData.forEach(franchise => {
        franchiseOptions.push({
            name: `${franchise.slug} — ${franchise.name}`,
            value: franchise.name,
        })
    });

    return franchiseOptions;
}
