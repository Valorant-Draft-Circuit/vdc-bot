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
	name: `queue`,
	description: `Join or manage the Combines queue system.`,
	contexts: [InteractionContextType.Guild],
	options: [
		{
			name: `join`,
			description: `Join the queue for your eligible tier.`,
			type: ApplicationCommandOptionType.Subcommand,
		},
		{
			name: `leave`,
			description: `Leave the queue if you are waiting for a match.`,
			type: ApplicationCommandOptionType.Subcommand,
		},
	],
};
