const { Tier } = require(`@prisma/client`);
const { ApplicationCommandOptionType, InteractionContextType, PermissionFlagsBits } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `league`,
    description: `Access league commands here!`,
    default_member_permissions: !Boolean(Number(process.env.PROD)) ? `0x0` : PermissionFlagsBits.BanMembers,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `update-franchise-management`,
            description: `Update the members of a franchise's franchise management`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `operation`,
                    description: `The operation to execute`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `remove`, value: `remove` },
                        { name: `add`, value: `add` },
                    ]
                },
                {
                    name: `franchise`,
                    description: `The franchise to update management for`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: franchiseChoices()
                },
                {
                    name: `type`,
                    description: `The franchise management type`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `General Manager`, value: `GM` },
                        { name: `Assistant General Manager`, value: `AGM` },
                    ]
                },
                {
                    name: `player`,
                    description: `The player to update`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        },
        {
            name: `refresh-franchises-channel`,
            description: `Force a refresh of the franchises channel`,
            type: ApplicationCommandOptionType.Subcommand
        },
        {
            name: `modify-accolades`,
            description: `Modify a player's accolades`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `operation`,
                    description: `The operation to execute`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `remove`, value: `remove` },
                        { name: `add`, value: `add` },
                    ]
                },
                {
                    name: `accolade`,
                    description: `The accolade to modify`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `Grand Finals Winner`, value: `WIN` },
                        { name: `FM for a Grand Finals Winner`, value: `WIN_FM` },
                        { name: `Winning Substitute`, value: `WIN_SUB` },
                        { name: `All Star`, value: `AST` },
                        { name: `MVP`, value: `MVP` },

                    ]
                },
                {
                    name: `season`,
                    description: `The season of the accolade`,
                    type: ApplicationCommandOptionType.Number,
                    required: true,
                },
                {
                    name: `tier`,
                    description: `The tier of the accolade`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: 'Recruit', value: Tier.RECRUIT },
                        { name: `Prospect`, value: Tier.PROSPECT },
                        { name: `Apprentice`, value: Tier.APPRENTICE },
                        { name: `Expert`, value: Tier.EXPERT },
                        { name: `Mythic`, value: Tier.MYTHIC },

                    ]
                },
                {
                    name: `player`,
                    description: `The player to update`,
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ]
        },
        {
            name: `award-final`,
            description: `Award championship accolades (WIN, WIN_FM, WIN_SUB) to a grand final's winner`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `match-id`,
                    description: `The grand final's match ID (run after the final is submitted and processed)`,
                    type: ApplicationCommandOptionType.Integer,
                    required: true
                }
            ]
        },
        {
            name: `award-pickems`,
            description: `Award Pick'Ems accolades (overall, per-tier, top group) for a season`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `season`,
                    description: `The season to award Pick'Ems accolades for (run after Pick'Ems are fully resolved)`,
                    type: ApplicationCommandOptionType.Integer,
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