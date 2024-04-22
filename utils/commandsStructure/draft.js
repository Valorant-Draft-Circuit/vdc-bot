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
const { Tier } = require("@prisma/client");
const { ApplicationCommandOptionType } = require(`discord.js`);

module.exports = {
	name: "draft",
	description: "Access Draft commands here!",
	options: [
		{
			name: `generate-lottery`,
			description: "Generate The draft lottery for a tier",
			type: ApplicationCommandOptionType.Subcommand,
			default_member_permissions: `0x0000000000002000`,
			options: [
				{
					name: "tier",
					description: "Select a tier",
					type: ApplicationCommandOptionType.String,
					required: true,
					choices: [
						{ name: `Prospect`, value: Tier.PROSPECT },
						{ name: `Apprentice`, value: Tier.APPRENTICE },
						{ name: `Expert`, value: Tier.EXPERT },
						{ name: `Mythic`, value: Tier.MYTHIC },
					],
				},
			],
		},
		{
			name: `award-comp-picks`,
			description: "Award a compensation pick to a franchise",
			type: ApplicationCommandOptionType.Subcommand,
			default_member_permissions: `0x0000000000002000`,
			options: [
				{
					name: "round",
					description: "List a round",
					type: ApplicationCommandOptionType.Number,
					required: true,
				},
				{
					name: "tier",
					description: "Select a tier",
					type: ApplicationCommandOptionType.String,
					required: true,
					choices: [
						{ name: `Prospect`, value: Tier.PROSPECT },
						{ name: `Apprentice`, value: Tier.APPRENTICE },
						{ name: `Expert`, value: Tier.EXPERT },
						{ name: `Mythic`, value: Tier.MYTHIC },
					],
				},
				{
					name: "franchise",
					description: "Select a franchise",
					type: ApplicationCommandOptionType.String,
					required: true,
					choices: franchiseChoices()
				},
			],
		},
		{
			name: `fulfill-future-trade`,
			description: "Fulfill a draft pick future",
			type: ApplicationCommandOptionType.Subcommand,
			default_member_permissions: `0x0000000000002000`,
			options: [
				{
					name: "round",
					description: "List a round",
					type: ApplicationCommandOptionType.Number,
					required: true,
				},
				{
					name: "tier",
					description: "Select a tier",
					type: ApplicationCommandOptionType.String,
					required: true,
					choices: [
						{ name: `Prospect`, value: Tier.PROSPECT },
						{ name: `Apprentice`, value: Tier.APPRENTICE },
						{ name: `Expert`, value: Tier.EXPERT },
						{ name: `Mythic`, value: Tier.MYTHIC },
					],
				},
				{
					name: "franchise-from",
					description: "Select a franchise",
					type: ApplicationCommandOptionType.String,
					required: true,
					choices: franchiseChoices()
				},
				{
					name: "franchise-to",
					description: "Select a franchise",
					type: ApplicationCommandOptionType.String,
					required: true,
					choices: franchiseChoices()
				},
			],
		},
		{
			name: `view-draft-board`,
			description: "View the draft board for a tier",
			type: ApplicationCommandOptionType.Subcommand,
			options: [
				{
					name: "tier",
					description: "Select a tier",
					type: ApplicationCommandOptionType.String,
					required: true,
					choices: [
						{ name: `Prospect`, value: Tier.PROSPECT },
						{ name: `Apprentice`, value: Tier.APPRENTICE },
						{ name: `Expert`, value: Tier.EXPERT },
						{ name: `Mythic`, value: Tier.MYTHIC },
					],
				},
			],
		},
		{
			name: `set-keeper-pick`,
			description: "Set a keeper pick for a tier",
			type: ApplicationCommandOptionType.Subcommand,
			default_member_permissions: `0x0000000000002000`,
			options: [
				{
					name: "round",
					description: "List a round",
					type: ApplicationCommandOptionType.Number,
					required: true,
				},
				{
					name: "pick",
					description: "List a pick",
					type: ApplicationCommandOptionType.Number,
					required: true,
				},
				{
					name: "tier",
					description: "Select a tier",
					type: ApplicationCommandOptionType.String,
					required: true,
					choices: [
						{ name: `Prospect`, value: Tier.PROSPECT },
						{ name: `Apprentice`, value: Tier.APPRENTICE },
						{ name: `Expert`, value: Tier.EXPERT },
						{ name: `Mythic`, value: Tier.MYTHIC },
					],
				},
				{
					name: "user",
					description: "The user to set as keeper pick",
					type: ApplicationCommandOptionType.User,
					required: true,
				},
			],
		},
		{
			name: `reset-keeper-pick`,
			description: "Reset/remove a keeper pick",
			type: ApplicationCommandOptionType.Subcommand,
			default_member_permissions: `0x0000000000002000`,
			options: [
				{
					name: "user",
					description: "The user to set as keeper pick",
					type: ApplicationCommandOptionType.User,
					required: true,
				},
			],
		},
	],
};

function franchiseChoices() {
	const franchiseData = require(`../../cache/franchises.json`);
	const signOptions = [];

	franchiseData.forEach(franchise => {
		signOptions.push({
			name: `${franchise.slug} — ${franchise.name}`,
			value: franchise.name,
		})
	});

	return signOptions;
}