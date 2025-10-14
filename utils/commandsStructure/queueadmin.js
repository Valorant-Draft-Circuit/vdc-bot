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

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `queueadmin`,
    description: `Administrative queue controls (admin role required).`,
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
                    name: `match_id`,
                    description: `Internal queue match identifier.`,
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
    ],
};
