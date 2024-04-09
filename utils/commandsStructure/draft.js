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

module.exports = {
  name: "draft",
  description: "Access Draft commands here!",
  options: [
    {
      name: `generate-lottery`,
      description: "Generate The Lottery for a Tier",
      type: ApplicationCommandOptionType.Subcommand,

      options: [
        {
          name: "tier",
          description: "Select a Tier",
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            { name: `Prospect`, value: `PROSPECT` },
            { name: `Apprentice`, value: `APPRENTICE` },
            { name: `Expert`, value: `EXPERT` },
            { name: `Mythic`, value: `MYTHIC` },
          ],
        },
      ],
    },
  ],
};
