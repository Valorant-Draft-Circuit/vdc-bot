const { LeagueStatus, ContractStatus } = require(`@prisma/client`);
const { ApplicationCommandOptionType, InteractionContextType, PermissionFlagsBits } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `debug`,
    description: `Access debug commands here!`,
    default_member_permissions: !Boolean(Number(process.env.PROD)) ? `0x0` : PermissionFlagsBits.BanMembers,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `user`,
            description: `Get all information about a user`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `player`,
                    description: `The player to debug`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
            ],
        },
        {
            name: `report`,
            description: `Generate a report for all player's LeagueStatuses`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `type`,
                    description: `The type of report to generate`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `Player League Status`, value: `PLAYER_LEAGUE_STATUS` },
                        { name: `Franchise Information`, value: `FRANCHISE_INFORMATION` },
                        { name: `Admin Tier List`, value: `ADMIN_TIER_LIST` },
                        { name: `Expiring Contracts`, value: `EXPIRING_CONTRACTS` },
                    ]
                },
            ]
        },
        {
            name: `force-update`,
            description: `Forcefully update a user's information`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `player`,
                    description: `The player to debug`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: `league-status`,
                    description: `The league status to update to`,
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        { name: `Unregistered`, value: LeagueStatus.UNREGISTERED },
                        { name: `Pending`, value: LeagueStatus.PENDING },
                        { name: `Approved`, value: LeagueStatus.APPROVED },
                        { name: `Draft Eligible`, value: LeagueStatus.DRAFT_ELIGIBLE },
                        { name: `Free Agent`, value: LeagueStatus.FREE_AGENT },
                        { name: `Restricted Free Agent`, value: LeagueStatus.RESTRICTED_FREE_AGENT },
                        { name: `Signed`, value: LeagueStatus.SIGNED },
                        { name: `General Manager`, value: LeagueStatus.GENERAL_MANAGER },
                        { name: `Retired`, value: LeagueStatus.RETIRED },
                        { name: `Suspended`, value: LeagueStatus.SUSPENDED },
                    ]
                },
                {
                    name: `contract-status`,
                    description: `The contract status to update to`,
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        { name: `Signed`, value: ContractStatus.SIGNED },
                        { name: `Subbed Out`, value: ContractStatus.SUBBED_OUT },
                        { name: `Inactive Reserve`, value: ContractStatus.INACTIVE_RESERVE },
                        { name: `null`, value: `999` },
                    ]
                },
                {
                    name: `contract-remaining`,
                    description: `The contract status to update to`,
                    type: ApplicationCommandOptionType.Number,
                    required: false,
                    choices: [
                        { name: `null`, value: 999 },
                        { name: `0`, value: 0 },
                        { name: `1`, value: 1 },
                        { name: `2`, value: 2 },
                    ]
                },
                {
                    name: `team`,
                    description: `The team to update the player to`,
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    autocomplete: true
                }
            ],
        },
        {
            name: `update-by-ign`,
            description: `Forcefully update a user's information`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `ign`,
                    description: `The player to update`,
                    type: ApplicationCommandOptionType.String,
                    required: true
                },
                {
                    name: `league-status`,
                    description: `The league status to update to`,
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        { name: `Unregistered`, value: LeagueStatus.UNREGISTERED },
                        { name: `Pending`, value: LeagueStatus.PENDING },
                        { name: `Approved`, value: LeagueStatus.APPROVED },
                        { name: `Draft Eligible`, value: LeagueStatus.DRAFT_ELIGIBLE },
                        { name: `Free Agent`, value: LeagueStatus.FREE_AGENT },
                        { name: `Restricted Free Agent`, value: LeagueStatus.RESTRICTED_FREE_AGENT },
                        { name: `Signed`, value: LeagueStatus.SIGNED },
                        { name: `General Manager`, value: LeagueStatus.GENERAL_MANAGER },
                        { name: `Retired`, value: LeagueStatus.RETIRED },
                        { name: `Suspended`, value: LeagueStatus.SUSPENDED },
                    ]
                },
                {
                    name: `contract-status`,
                    description: `The contract status to update to`,
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        { name: `Signed`, value: ContractStatus.SIGNED },
                        { name: `Subbed Out`, value: ContractStatus.SUBBED_OUT },
                        { name: `Inactive Reserve`, value: ContractStatus.INACTIVE_RESERVE },
                        { name: `null`, value: `999` },
                    ]
                },
                {
                    name: `contract-remaining`,
                    description: `The contract status to update to`,
                    type: ApplicationCommandOptionType.Number,
                    required: false,
                    choices: [
                        { name: `null`, value: 999 },
                        { name: `0`, value: 0 },
                        { name: `1`, value: 1 },
                        { name: `2`, value: 2 },
                    ]
                },
                {
                    name: `team`,
                    description: `The team to update the player to`,
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    autocomplete: true
                },
                {
                    name: `set-team-null`,
                    description: `Set the player's team to null!`,
                    type: ApplicationCommandOptionType.Boolean,
                    required: false,
                }
            ],
        },
        {
            name: `process-inactive`,
            description: `Process the inactive state for a user`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `player`,
                    description: `The player to process the inactive state for`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
            ],
        },
        {
            name: `update-mmr`,
            description: `Update a player's effectiveMMR`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `player`,
                    description: `The player whose mmr to update`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: `new-mmr`,
                    description: `The new MMR of the player`,
                    type: ApplicationCommandOptionType.Number,
                    required: true
                },
            ],
        },
        {
            name: `profile-update`,
            description: `Forcefully update a player's profile in discord`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `player`,
                    description: `The player to update`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
            ],
        },
        {
            name: `refresh-cache`,
            description: `Update the bot's MMR cache`,
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: `profile-update-server`,
            description: `WARNING: This will update the profile of all players in the server!`,
            type: ApplicationCommandOptionType.Subcommand
        },
    ]
}