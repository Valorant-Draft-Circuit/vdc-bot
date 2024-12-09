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
            name: `info`,
            description: `Get information about a franchise`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `franchise`,
                    description: `The franchise's info you're looking for`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: franchiseChoices()
                }
            ]
        },
        {
            name: `update-description`,
            description: `Update the description for your franchise`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `description`,
                    description: `Upload a .txt file with your franchise's new description`,
                    type: ApplicationCommandOptionType.Attachment,
                    required: true,
                }
            ]
        },
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
