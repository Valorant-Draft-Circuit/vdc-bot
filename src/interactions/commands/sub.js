const { EmbedBuilder, ChatInputCommandInteraction } = require("discord.js");

const { Player, ControlPanel } = require("../../../prisma");
const { LeagueStatus, ContractStatus } = require("@prisma/client");

const COLORS = {
    PROSPECT: 0xFEC335,
    APPRENTICE: 0x72C357,
    EXPERT: 0x04AEE4,
    MYTHIC: 0xA657A6,
}


module.exports = {

    name: `sub`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply();

        const showMMR = await ControlPanel.getMMRDisplayState();
        const mmrTierLines = await ControlPanel.getMMRCaps(`PLAYER`);

        const tier = interaction.options._hoistedOptions[0].value;
        const mmrMax = interaction.options._hoistedOptions[1]?.value;

        const capMin = mmrTierLines[tier].min;
        const capMax = mmrMax && showMMR ? mmrMax : mmrTierLines[tier].max;

        // get all active subs, filter to be within MMR paramaters and sort by least to greatest
        const activeSubs = (await Player.getAllSubs()).map((player) => {
            const ign = player.PrimaryRiotAccount.riotIGN;

            return {
                id: player.id,
                ignPlain: ign.split(`#`)[0],
                ign: ign,
                trackerURL: `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(ign)}`,
                leagueStatus: player.Status.leagueStatus,
                contractStatus: player.Status.contractStatus,
                mmr: Math.round(player.PrimaryRiotAccount?.MMR.mmrEffective)
            }
        }).filter(player => player.mmr >= capMin && player.mmr < capMax).sort((a, b) => a.mmr - b.mmr);

        // filter by FA/RFA and format with Riot ID and Tracker link
        const descriptionFA = activeSubs
            .filter(player => player.leagueStatus === LeagueStatus.FREE_AGENT && player.contractStatus == null)
            .map(p => `${showMMR ? `\` ${String(p.mmr).padStart(3)} \` | ` : ``}[${p.ignPlain}](${p.trackerURL})`);
        const descriptionRFA = activeSubs
            .filter(player => player.leagueStatus === LeagueStatus.RESTRICTED_FREE_AGENT && player.contractStatus == null)
            .map(p => `${showMMR ? `\` ${String(p.mmr).padStart(3)} \` | ` : ``}[${p.ignPlain}](${p.trackerURL})`);
        const subInUseDescription = activeSubs
            .filter(player => player.contractStatus == ContractStatus.ACTIVE_SUB)
            .map(p => `${showMMR ? `\` ${String(p.mmr).padStart(3)} \` | ` : ``}[${p.ignPlain}](${p.trackerURL})`);


        // add if the type of sub ONLY IF it has players in it
        const description = [];
        if (descriptionFA.length > 0) description.push([`__Free Agents__`, ...descriptionFA].join(`\n`));
        if (descriptionRFA.length > 0) description.push([`__Restricted Free Agents__`, ...descriptionRFA].join(`\n`));
        if (subInUseDescription.length > 0) description.push([`__Active Substitute(s)__`, ...subInUseDescription].join(`\n`));

        // and then create the embed
        const embed = new EmbedBuilder({
            author: { name: `${tier} Substitutes` },
            description: description.join(`\n\n`),
            color: COLORS[tier],
            footer: { text: `Valorant Draft Circuit - ${tier} Substitutes` }
        });

        if (showMMR) embed.addFields({
            name: `\u200B`,
            value: `MMR: ${capMin} - ${capMax}`
        });

        return await interaction.editReply({ embeds: [embed] })
    }
};