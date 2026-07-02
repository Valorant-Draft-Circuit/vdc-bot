const { AutocompleteInteraction } = require(`discord.js`);
const { readCacheJson } = require(`../../../utils/readCacheJson.js`);

module.exports = {

    name: `team`,

    async execute(/** @type AutocompleteInteraction */ interaction) {
        const focusedValue = interaction.options.getFocused();
        const choices = teamChoices();
        const query = focusedValue.toLowerCase();

        const filtered = choices.filter(choice => { return choice.name.toLowerCase().includes(query) });
        filtered.splice(25, filtered.length);
        return await interaction.respond(filtered);
    }
};


function teamChoices() {
    const teamCache = readCacheJson(`teams.json`);
    const teamOptions = [];

    teamCache.forEach(team => {
        teamOptions.push({
            name: `${team.slug} — ${team.tier[0].toUpperCase() + team.tier.substring(1).toLowerCase()} — ${team.name}`,
            value: team.name,
        });
    });

    return teamOptions;
}