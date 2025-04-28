const { ApplicationCommandOptionType, InteractionContextType, PermissionFlagsBits } = require(`discord.js`);
const fs = require(`fs`);

const reportFiles = fs.readdirSync(`./src/interactions/subcommands/report`).filter(f => f.endsWith(`.js`) && f !== `_template.js`);
const choiceOptions = [];

reportFiles.forEach(reportFile => {
    const reportPath = `../../src/interactions/subcommands/report/${reportFile}`;
    const command = require(reportPath);
    choiceOptions.push({
        name: command.readable,
        value: command.name
    });
});

/** @type {import('discord.js').RESTPostAPIApplicationCommandsJSONBody} */
module.exports = {
    name: `report`,
    description: `Generate reports for the league`,
    default_member_permissions: !Boolean(Number(process.env.PROD)) ? `0x0` : PermissionFlagsBits.BanMembers,
    contexts: [InteractionContextType.Guild],
    options: [
        {
            name: `type`,
            description: `The type of report you'd like to generate`,
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: choiceOptions,
        },
        {
            name: `args`,
            description: `Arguments for the report (if any)`,
            type: ApplicationCommandOptionType.String,
            required: false,
        }
    ]
}
