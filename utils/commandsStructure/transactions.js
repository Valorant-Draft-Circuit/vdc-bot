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
                    name: `team`,
                    description: "The team to sign the player to",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                }
            ]
        },
        {
            name: "draft-sign",
            description: "Sign a player to a franchise from the draft",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "round",
                    description: "The round the player is being drafted in",
                    type: ApplicationCommandOptionType.Number,
                    required: true
                },
                {
                    name: "pick",
                    description: "The round pick the player was drafted in",
                    type: ApplicationCommandOptionType.Number,
                    required: true
                },
                {
                    name: "user",
                    description: "The player to sign from the draft",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: `team`,
                    description: "The team to sign the player to",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                }
            ]
        },
        {
            name: "trade",
            description: "Trade players between teams",
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
                },
                {
                    name: "optional-cut-1",
                    description: "The player to cut from the team",
                    type: ApplicationCommandOptionType.User,
                    required: false
                },
                {
                    name: "optional-cut-2",
                    description: "The player to cut from the team",
                    type: ApplicationCommandOptionType.User,
                    required: false
                },
                {
                    name: "optional-sign-1",
                    description: "The player to sign to the team",
                    type: ApplicationCommandOptionType.User,
                    required: false
                },
                {
                    name: "optional-sign-2",
                    description: "The player to sign to the team",
                    type: ApplicationCommandOptionType.User,
                    required: false
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
        },
        {
            name: "renew",
            description: "Renew a player's contract",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "user",
                    description: "The player to renew a contract for",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: `team`,
                    description: "The team to sign the renew to",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                }
            ]
        },
        {
            name: "update-tier",
            description: "Update a player's tier",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "player",
                    description: "The player whose tier you'd like to change",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: `tier`,
                    description: "The tier you'd like to update them to",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `Prospect`, value: `Prospect` },
                        { name: `Apprentice`, value: `Apprentice` },
                        { name: `Expert`, value: `Expert` },
                        { name: `Mythic`, value: `Mythic` },
                    ]
                }
            ]
        }
    ]
}