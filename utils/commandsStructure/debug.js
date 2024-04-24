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
    name: "debug",
    description: "Access debug commands here!",
    default_member_permissions: `0x0000000000002000`,
    options: [
        {
            name: "user",
            description: "Get all information about a user",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "player",
                    description: "The player to debug",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
            ],
        },
        {
            name: "report",
            description: "Generate a report for all player's LeagueStatuses",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `type`,
                    description: "The type of report to generate",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `Player League Status`, value: `PLAYER_LEAGUE_STATUS` },
                        { name: `Franchise Information`, value: `FRANCHISE_INFORMATION` },
                        { name: `Admin Tier List`, value: `ADMIN_TIER_LIST` },
                    ]
                },
            ]
        },
        {
            name: "force-update",
            description: "Get all information about a user",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: "player",
                    description: "The player to debug",
                    type: ApplicationCommandOptionType.User,
                    required: true
                },
                {
                    name: `league-status`,
                    description: "The league status to update to",
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        { name: `Draft Eligible`, value: LeagueStatus.DRAFT_ELIGIBLE },
                        { name: `Free Agent`, value: LeagueStatus.FREE_AGENT },
                        { name: `Restricted Free Agent`, value: LeagueStatus.RESTRICTED_FREE_AGENT },
                        { name: `Signed`, value: LeagueStatus.SIGNED },
                        { name: `General Manager`, value: LeagueStatus.GENERAL_MANAGER },
                        { name: `Suspended`, value: LeagueStatus.SUSPENDED },
                    ]
                },
                {
                    name: `contract-status`,
                    description: "The contract status to update to",
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    choices: [
                        { name: `Signed`, value: ContractStatus.SIGNED },
                        { name: `Inactive Reserve`, value: ContractStatus.INACTIVE_RESERVE },
                        { name: `null`, value: `999` },
                    ]
                },
                {
                    name: `contract-remaining`,
                    description: "The contract status to update to",
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
                    description: "The team to update the player to",
                    type: ApplicationCommandOptionType.String,
                    required: false,
                    autocomplete: true
                }
            ],
        },
    ]
}