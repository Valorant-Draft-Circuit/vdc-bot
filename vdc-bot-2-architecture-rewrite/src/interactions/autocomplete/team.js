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
    // console.log(teamCache)

    const teamOptions = [];
    // console.log(teamCache)

    teamCache.forEach(team => {
        teamOptions.push({
            name: `${team.slug} — ${team.name}`,
            value: team.name,
        })
    });

    return teamOptions;
}