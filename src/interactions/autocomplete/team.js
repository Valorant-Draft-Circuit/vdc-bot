const { AutocompleteInteraction } = require(`discord.js`);

module.exports = {

    name: `team`,

    async execute(/** @type AutocompleteInteraction */ interaction) {
        const focusedValue = interaction.options.getFocused();
        console.log(focusedValue)
        const choices = teamChoices();
        const query = focusedValue.toLowerCase();

        const filtered = choices.filter(choice => { return choice.name.toLowerCase().includes(query) });
        filtered.splice(25, filtered.length);
        return await interaction.respond(filtered);
    }
};


function teamChoices() {
    const teamCache = require(`../../../cache/teams.json`);
    const teamOptions = [];

    teamCache.forEach(team => {
        teamOptions.push({
            name: `${team.slug} — ${team.tier[0].toUpperCase() + team.tier.substring(1).toLowerCase()} — ${team.name}`,
            value: team.name,
        });
    });

    return teamOptions;
}