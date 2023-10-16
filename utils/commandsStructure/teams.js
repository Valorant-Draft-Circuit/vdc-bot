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
    name: "teams",
    description: "Get a franchise's teams",
    options: [
        {
            name: `franchise`,
            description: "The franchise to get teams for",
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: franchiseChoices()
        }
    ]
}

function franchiseChoices() {
    const franchiseData = require(`../../cache/franchises.json`);

    const signOptions = [];

    franchiseData.forEach(franchise => {
        signOptions.push({
            name: `${franchise.slug} — ${franchise.name}`,
            value: franchise.name,
        })
    });

    return signOptions;
}
