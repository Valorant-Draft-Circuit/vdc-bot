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
    description: "USE WITH CAUTION. FORCEFULLY MAKES CHANGES TO THE DATABASE WITH NO CHECKS.",
    options: [
        {
            name: `player`,
            description: "Forcefully make player related database changes",
            type: ApplicationCommandOptionType.SubcommandGroup,
            options: [
                {
                    name: `update`,
                    description: "CAUTION: Forcefully update a player in the database.",
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
                            ]
                        },
                        {
                            name: "mmr",
                            description: "Update a player's MMR value",
                            type: ApplicationCommandOptionType.Number,
                        }
                    ]
                }
            ]
        }
    ]
}
