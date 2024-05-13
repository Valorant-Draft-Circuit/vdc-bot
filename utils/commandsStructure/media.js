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
    name: "media",
    description: "Access media commands here!",
    default_member_permissions: `0x0000000000002000`,
    options: [
        {
            name: "generate-season-thumbnail",
            description: "Generate a thumbnail for a season's game",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `home-team`,
                    description: "Home team",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                },
                {
                    name: `away-team`,
                    description: "Away team",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                },
                {
                    name: `day`,
                    description: "Match day",
                    type: ApplicationCommandOptionType.Number,
                    required: true,
                },
                {
                    name: `time`,
                    description: "Match time (Defaults to 9:00 EST / 6:00 PST)",
                    type: ApplicationCommandOptionType.String,
                    required: false,
                },
            ]
        },
        {
            name: "generate-playoffs-images",
            description: "Generate a thumbnail for a season's game",
            type: ApplicationCommandOptionType.Subcommand,
            options: [
                {
                    name: `home-team`,
                    description: "Home team",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                },
                {
                    name: `away-team`,
                    description: "Away team",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    autocomplete: true
                },
                {
                    name: `image-type`,
                    description: "The type of image to generate",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `Promotional Image`, value: `promo` },
                        { name: `Thumbnail`, value: `thumb` },
                    ]
                },
                {
                    name: `match-type`,
                    description: "The type of match",
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: [
                        { name: `Play In`, value: `play-in` },
                        { name: `Semi Finals`, value: `semi-finals` },
                        { name: `Grand Finals`, value: `grand-finals` },
                    ]
                },
                {
                    name: `time`,
                    description: "Match time (Defaults to 9:00 EST / 6:00 PST)",
                    type: ApplicationCommandOptionType.String,
                    required: false,
                },
            ]
        },
    ]
}