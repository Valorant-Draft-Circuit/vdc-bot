const { Tier } = require(`@prisma/client`);
const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `transactions`,
    description: `Access transactions commands here!`,
    contexts: [InteractionContextType.Guild],
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
                },
                {
                    name: `length`,
                    description: `The length of the contract`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `1`, value: "1" },
                        { name: `2`, value: "2" },
                    ]
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
                        { name: 'Recruit', value: Tier.RECRUIT },
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
        },
        {
            name: `reschedule`,
            description: `Reschedule a match to a new date`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `team`,
                    description: `Either team involved in the reschedule`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                },
                {
                    name: `matchday`,
                    description: `The matchday to reschedule`,
                    type: ApplicationCommandOptionType.Integer,
                    required: true,
                },
                {
                    name: `date`,
                    description: `The date & time to reschedule to (EST)`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                }
            ]
        },
        {
            name: `schedule-playoff`,
            description: `Schedule a new playoff match`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `home-team`,
                    description: `The home team for the playoff match`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                },
                {
                    name: `away-team`,
                    description: `The away team for the playoff match`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                },
                {
                    name: `tier`,
                    description: `Tier of the playoff match`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `RECRUIT`, value: `RECRUIT` },
                        { name: `PROSPECT`, value: `PROSPECT` },
                        { name: `APPRENTICE`, value: `APPRENTICE` },
                        { name: `EXPERT`, value: `EXPERT` },
                        { name: `MYTHIC`, value: `MYTHIC` },
                        { name: `MIXED`, value: `MIXED` },
                    ]
                },
                {
                    name: `match-type`,
                    description: `Match type for the playoff match`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `BO2`, value: `BO2` },
                        { name: `BO3`, value: `BO3` },
                        { name: `BO5`, value: `BO5` },
                    ]
                },
                {
                    name: `matchday`,
                    description: `The matchday number for the playoff`,
                    type: ApplicationCommandOptionType.Integer,
                    required: true,
                },
                {
                    name: `date`,
                    description: `The date & time to schedule (Discord Timestamp: <t:TIMESTAMP:f>)`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
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