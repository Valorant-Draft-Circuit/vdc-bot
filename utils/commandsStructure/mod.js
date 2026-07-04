const { ApplicationCommandOptionType, InteractionContextType } = require(`discord.js`);

const userOption = (description) => ({
    name: `user`,
    description,
    type: ApplicationCommandOptionType.User,
    required: true,
});

const reasonOption = (description, required = true) => ({
    name: `reason`,
    description,
    type: ApplicationCommandOptionType.String,
    required,
});

const rulesOption = {
    name: `rules`,
    description: `Rules broken, e.g. "Rule 36: Unsportsmanlike conduct, Rule 8: ..."`,
    type: ApplicationCommandOptionType.String,
    required: true,
};

const durationOption = {
    name: `duration`,
    description: `Duration: 45s, 12h, 32d, 2w - or "perm" / "season" / "4seasons" (bans)`,
    type: ApplicationCommandOptionType.String,
    required: true,
};

const appealableOption = {
    name: `appealable`,
    description: `Can the player appeal this punishment? (default: yes)`,
    type: ApplicationCommandOptionType.Boolean,
    required: false,
};

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `mod`,
    description: `Moderation tools (staff only)`,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `note`,
            description: `Attach a staff-internal note to a player`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [userOption(`The player the note is about`), reasonOption(`The note text (lead with the rule reference)`)],
        },
        {
            name: `warn`,
            description: `Warn a player (logged; player is DMed)`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                userOption(`The player to warn`),
                {
                    name: `formal`,
                    description: `Formal warning? (false = informal)`,
                    type: ApplicationCommandOptionType.Boolean,
                    required: true,
                },
                rulesOption,
                reasonOption(`Explanation for the warning`),
            ],
        },
        {
            name: `mute`,
            description: `Mute a player (strips roles, applies Muted role)`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [userOption(`The player to mute`), durationOption, rulesOption, reasonOption(`Explanation for the mute`), appealableOption],
        },
        {
            name: `ban`,
            description: `Ban a player from the server`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [userOption(`The player to ban`), durationOption, rulesOption, reasonOption(`Explanation for the ban`), appealableOption],
        },
        {
            name: `unmute`,
            description: `Lift a player's mute early`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [userOption(`The player to unmute`), reasonOption(`Why the mute is lifted (e.g. appeal)`, false)],
        },
        {
            name: `unban`,
            description: `Lift a player's ban early`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [userOption(`The player to unban`), reasonOption(`Why the ban is lifted (e.g. appeal)`, false)],
        },
        {
            name: `history`,
            description: `View a player's moderation history`,
            type: ApplicationCommandOptionType.Subcommand,
            options: [userOption(`The player to look up`)],
        },
        {
            name: `help`,
            description: `How to use the moderation commands`,
            type: ApplicationCommandOptionType.Subcommand,
        },
    ],
};
