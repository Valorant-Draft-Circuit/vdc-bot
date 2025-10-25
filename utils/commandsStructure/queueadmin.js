const { Tier } = require(`@prisma/client`);
const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

const TIER_CHOICES = [
    { name: `All`, value: `ALL` },
    { name: `Recruit`, value: Tier.RECRUIT },
    { name: `Prospect`, value: Tier.PROSPECT },
    { name: `Apprentice`, value: Tier.APPRENTICE },
    { name: `Expert`, value: Tier.EXPERT },
    { name: `Mythic`, value: Tier.MYTHIC },
];

const { PermissionFlagsBits } = require(`discord.js`);

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `queueadmin`,
    description: `Administrative queue controls.`,
    // Hide this command from users without Manage Guild (Manage Server) or Administrator
    default_member_permissions: String(PermissionFlagsBits.ManageGuild),
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `open`,
            description: `Open the queue for a specific tier.`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `tier`,
                    description: `Select which tier to open.`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: TIER_CHOICES,
                },
            ],
        },
        {
            name: `close`,
            description: `Close the queue for a specific tier.`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `tier`,
                    description: `Select which tier to close.`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: TIER_CHOICES,
                },
            ],
        },
        {
            name: `status`,
            description: `View live queue status.`,
            type: ApplicationCommandOptionType.Subcommand,
        },
        {
            name: `reset`,
            description: `Clear queues and unlock players.`,
            type: ApplicationCommandOptionType.Subcommand,
        },
        {
            name: `kill`,
            description: `Force cancel a match and clean up channels.`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `queue_id`,
                    description: `Internal queue identifier (Queue ID).`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                },
            ],
        },
        {
            name: `reload-config`,
            description: `Reload queue configuration from Control Panel.`,
            type: ApplicationCommandOptionType.Subcommand,
        },
        {
            name: `build`,
            description: `Force run the matchmaker for a tier.`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `tier`,
                    description: `Select which tier to evaluate.`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: TIER_CHOICES,
                },
            ],
        },
        {
            name: `create-dummies`,
            description: `Create dummy players and add them to a queue for testing.`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `tier`,
                    description: `Select which tier the dummies should belong to.`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: TIER_CHOICES,
                },
                {
                    name: `count`,
                    description: `How many dummy players to create (max 50).`,
                    type: ApplicationCommandOptionType.Integer,
                    required: true,
                },
                {
                    name: `bucket`,
                    description: `Which queue bucket to add dummies to (DE, FA_RFA, SIGNED).`,
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `DE`, value: `DE` },
                        { name: `FA_RFA`, value: `FA_RFA` },
                        { name: `SIGNED`, value: `SIGNED` },
                    ],
                },
                {
                    name: `games`,
                    description: `Optional: how many games the dummy player has played (used to seed gameCount).`,
                    type: ApplicationCommandOptionType.Integer,
                    required: false,
                },
                {
                    name: `completed`,
                    description: `Optional: place dummies into the lower-priority completed pool instead of the primary queue.`,
                    type: ApplicationCommandOptionType.Boolean,
                    required: false,
                },
            ],
        },
    ],
};
