const { EmbedBuilder, ChatInputCommandInteraction } = require("discord.js");

const { Player } = require("../../../prisma");
const { PlayerStatusCode } = require("../../../utils/enums");

const tiercaps = {
    prospect: 93,
    apprentice: 118,
    expert: 160,
}; // max MMR for these tiers (mythic has no max MMR)


module.exports = {

    name: `sub`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        return interaction.reply({ content: `This isn't ready for season 6 yet!` });
        await interaction.deferReply();

        const tier = interaction.options._hoistedOptions[0].value;
        const mmrMax = interaction.options._hoistedOptions[1]?.value;

        // logic to correcly determine MMR ranges for a tier
        const capMin = tier === `Mythic` ? tiercaps.expert : tier === `Prospect` ? 0 : tiercaps[Object.keys(tiercaps)[Object.keys(tiercaps).indexOf(tier.toLowerCase()) - 1]];
        const capMax = mmrMax ? mmrMax : tier == `Mythic` ? 999 : tiercaps[tier.toLowerCase()];

        // get all active subs, filter to be within MMR paramaters and sort by least to greatest
        const activeSubs = (await Player.getAllSubs()).map((player) => {
            return {
                id: player.id,
                riotIDPlain: player.Account.riotID.split(`#`)[0],
                riotID: player.Account.riotID,
                trackerURL: `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(player.Account.riotID)}`,
                status: player.status,
                type: player.status == PlayerStatusCode.FREE_AGENT ? ` FA` : `RFA`,
                mmr: player.MMR_Player_MMRToMMR?.mmr_overall
            }
        }).filter(player => player.mmr >= capMin && player.mmr < capMax).sort((a, b) => a.mmr - b.mmr);

        // filter by FA/RFA and format with Riot ID and Tracker link
        const descriptionFA = activeSubs
            .filter(player => player.status === PlayerStatusCode.FREE_AGENT)
            .map(p => `\` ${String(p.mmr).padStart(3)} \` | [${p.riotIDPlain}](${p.trackerURL})`);
        const descriptionRFA = activeSubs
            .filter(player => player.status === PlayerStatusCode.RESTRICTED_FREE_AGENT)
            .map(p => `\` ${String(p.mmr).padStart(3)} \` | [${p.riotIDPlain}](${p.trackerURL})`);


        // add if the type of sub ONLY IF it has players in it
        const description = [];
        if (descriptionFA.length > 0) description.push([`__Free Agents__`, ...descriptionFA].join(`\n`));
        if (descriptionRFA.length > 0) description.push([`__Restricted Free Agents__`, ...descriptionRFA].join(`\n`));

        // and then create the embed
        const embed = new EmbedBuilder({
            author: { name: `${tier} Substitutes` },
            description: description.join(`\n\n`),
            color: 0xE92929,
            fields: [
                {
                    name: `\u200B`,
                    value: `MMR: ${capMin} - ${capMax}`
                },
            ],
            footer: { text: `Valorant Draft Circuit - ${tier} Substitutes` }
        });

        return await interaction.editReply({ embeds: [embed] })
    }
};