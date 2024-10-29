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
const { LeagueStatus, ContractStatus } = require("@prisma/client");
const { ApplicationCommandOptionType } = require(`discord.js`);

module.exports = {
    name: "league",
    description: "Access league commands here!",
    default_member_permissions: process.env.ENVIRONMENT == `DEV` ? `0x0` : `0x0000000000002000`,
    options: [
        {
            name: "update-franchise-management",
            description: "Update the members of a franchise's franchise management",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `operation`,
                    description: "The operation to execute",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `remove`, value: `remove` },
                        { name: `add`, value: `add` },
                    ]
                },
                {
                    name: `franchise`,
                    description: "The franchise to update management for",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: franchiseChoices()
                },
                {
                    name: `type`,
                    description: "The franchise management type",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `General Manager`, value: `GM` },
                        { name: `Assistant General Manager`, value: `AGM` },
                    ]
                },
                {
                    name: "player",
                    description: "The player to update",
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
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