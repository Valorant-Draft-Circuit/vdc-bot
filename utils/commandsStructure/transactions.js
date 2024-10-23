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
const { Tier } = require(`@prisma/client`);
const { ApplicationCommandOptionType } = require(`discord.js`);

module.exports = {
    name: `transactions`,
    description: `Access transactions commands here!`,
    options: [
        {
            name: `sub`,
            description: `Assign a substitute to a team`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `substitute`,
                    description: `The player to who will be subbing`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: `for`,
                    description: `The team member to who will be subbed out`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        },
        {
            name: `unsub`,
            description: `Forcefully unsign a sub (use in the event this doesn't happen automatically)`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `user`,
                    description: `The player to whose temporary contract is complete`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
            ]
        },
        {
            name: `cut`,
            description: `Cut a rostered player from their team`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `user`,
                    description: `The player to cut`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        },
        {
            name: `sign`,
            description: `Sign a player to a franchise`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `user`,
                    description: `The player to sign`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: `team`,
                    description: `The team to sign the player to`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                }
            ]
        },
        {
            name: `ir`,
            description: `Toggle a rostered player's Inactive Reserve Status`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `user`,
                    description: `The player to toggle the IR status for`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        },
        {
            name: `captain`,
            description: `Toggle a rostered player's Captain Status`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `user`,
                    description: `The player to toggle the captain status for`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        },
        {
            name: `renew`,
            description: `Renew a player's contract`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `user`,
                    description: `The player to renew a contract for`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
            ]
        },
        {
            name: `expire`,
            description: `Finalize a player's contract expiration`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `user`,
                    description: `The player to finalize the contract expiration for`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
            ]
        },
        {
            name: `update-tier`,
            description: `Update a player's tier`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `player`,
                    description: `The player whose tier you'd like to change`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: `tier`,
                    description: `The tier you'd like to update them to`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `Prospect`, value: Tier.PROSPECT },
                        { name: `Apprentice`, value: Tier.APPRENTICE },
                        { name: `Expert`, value: Tier.EXPERT },
                        { name: `Mythic`, value: Tier.MYTHIC },
                    ]
                }
            ]
        },
        {
            name: `retire`,
            description: `Retire a rostered player`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `retire`,
                    description: `The player to retire`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
            ]
        },
        {
            name: `trade`,
            description: `Trade picks & players between two franchises`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `franchise-1`,
                    description: `The first franchise in the trade`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: franchiseChoices()
                },
                {
                    name: `franchise-2`,
                    description: `The second franchise in the trade`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: franchiseChoices()
                }
            ]
        }
    ]
}

function franchiseChoices() {
    const franchiseData = require(`../../cache/franchises.json`);
    const franchiseChoices = [];

    franchiseData.forEach(franchise => {
        franchiseChoices.push({
            name: `${franchise.slug} — ${franchise.name}`,
            value: franchise.name,
        })
    });

    return franchiseChoices;
}