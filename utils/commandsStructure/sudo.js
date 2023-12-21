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
const { ContractStatus, PlayerStatusCode } = require("../enums");

module.exports = {
    name: "sudo",
    description: "USE WITH CAUTION. SILENTLY & FORCEFULLY MAKES CHANGES TO A PLAYER IN THE DATABASE WITH NO CHECKS OR CONFIRMATION.",
    options: [
        {
            name: `player`,
            description: "Make updates to the player table",
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
                {
                    name: `update`,
                    description: "CAUTION: Silently & forcefully update a player in the database without any checks or confirmations",
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: `user`,
                            description: "The user to update",
                            type: ApplicationCommandOptionType.User,
                            required: true,
                        },
                        {
                            name: "team",
                            description: "Update a player's team",
                            type: ApplicationCommandOptionType.String,
                            autocomplete: true,
                        },
                        {
                            name: "status",
                            description: "Update a player's status in the league",
                            type: ApplicationCommandOptionType.Number,
                            choices: [
                                { name: `Unregistered`, value: PlayerStatusCode.UNREGISTERED },
                                { name: `Pending`, value: PlayerStatusCode.PENDING },
                                { name: `Draft Eligible`, value: PlayerStatusCode.DRAFT_ELIGIBLE },
                                { name: `Free Agent`, value: PlayerStatusCode.FREE_AGENT },
                                { name: `Restricted Free Agent`, value: PlayerStatusCode.RESTRICTED_FREE_AGENT },
                                { name: `Suspended`, value: PlayerStatusCode.SUSPENDED },
                                { name: `Signed`, value: PlayerStatusCode.SIGNED },
                                { name: `Former Player`, value: PlayerStatusCode.FORMER_PLAYER },
                            ]
                        },
                        {
                            name: "contract-status",
                            description: "Update a player's contract status with a franchise",
                            type: ApplicationCommandOptionType.Number,
                            choices: [
                                { name: `Signed`, value: ContractStatus.SIGNED },
                                { name: `Mid-Contract`, value: ContractStatus.MID_CONTRACT },
                                { name: `Expiring`, value: ContractStatus.EXPIRING },
                                { name: `Draft Eligible`, value: ContractStatus.DRAFT_ELIGIBLE },
                                { name: `Free Agent`, value: ContractStatus.FREE_AGENT },
                                { name: `Restricted Free Agent`, value: ContractStatus.RESTRICTED_FREE_AGENT },
                                { name: `GM Signed`, value: ContractStatus.GM_SIGNED },
                                { name: `GM Unsighed`, value: ContractStatus.GM_UNSIGNED },
                                { name: `Renewed`, value: ContractStatus.RENEWED },
                                { name: `Inactive Reserve`, value: ContractStatus.INACTIVE_RESERVE },
                                { name: `Active Substitute`, value: ContractStatus.ACTIVE_SUB },
                                { name: `Retired`, value: ContractStatus.RETIRED },
                            ]
                        },
                        // {
                        //     name: "mmr",
                        //     description: "Update a player's MMR value",
                        //     type: ApplicationCommandOptionType.Number,
                        // }
                    ]
                }
            ]
        }
    ]
}
