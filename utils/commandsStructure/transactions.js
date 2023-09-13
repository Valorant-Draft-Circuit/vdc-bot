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
    name: "transactions",
    description: "Access transactions commands here!",
    options: [
        {
            name: "sub",
            description: "Description",
            "type": ApplicationCommandOptionType.Subcommand,
        },
        {
            name: "cut",
            description: "Cut a rostered player from their team",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "user",
                    description: "The player to cut",
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        },
        {
            name: "sign",
            description: "Sign a player to a franchise",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "user",
                    description: "The player to sign",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: `franchise`,
                    description: "The franchise to sign the player to",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: franchiseChoices()
                }
            ]
        },
        {
            name: "swap",
            description: "Swap two players",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "cut",
                    description: "The player to cut from the team",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: "sign",
                    description: "The player to sign to the team",
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        },
        {
            name: "ir",
            description: "Toggle a rostered player's Inactive Reserve Status",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "user",
                    description: "The player to sign",
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
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
