const { EmbedBuilder, ChatInputCommandInteraction } = require(`discord.js`);
const { Player, ControlPanel } = require(`../../../../prisma`);
const { ContractStatus } = require(`@prisma/client`);
const { COLORS } = require(`../../../../utils/enums/colors`);

const TIERS = [`RECRUIT`, `PROSPECT`, `APPRENTICE`, `EXPERT`, `MYTHIC`];

async function activeSubs(/** @type ChatInputCommandInteraction */ interaction) {
    const [allSubs, mmrTierLines] = await Promise.all([
        Player.getAllSubs(),
        ControlPanel.getMMRCaps(`PLAYER`),
    ]);

    // only players currently acting as an active sub
    const players = allSubs
        .filter((player) => player.Status.contractStatus === ContractStatus.ACTIVE_SUB)
        .map((player) => {
            const ign = player.PrimaryRiotAccount.riotIGN;
            return {
                ignPlain: ign.split(`#`)[0],
                mmr: Math.round(player.PrimaryRiotAccount?.MMR?.mmrEffective || 0),
            };
        });

    // title block
    const titleEmbed = new EmbedBuilder({
        title: `Active Substitute(s)`,
        description: players.length > 0 ? `${players.length} active sub(s) across all tiers.` : `*No active substitutes league-wide.*`,
        color: 0xDE3845,
    });

    if (players.length === 0) return interaction.editReply({ embeds: [titleEmbed] });

    // one embed per tier
    const tierEmbeds = TIERS.map((tier) => {
        const { min, max } = mmrTierLines[tier];
        const tierLabel = `${tier[0]}${tier.substring(1).toLowerCase()}`;

        const lines = players
            .filter((p) => p.mmr >= min && p.mmr <= max)
            .sort((a, b) => a.mmr - b.mmr)
            .map((p) => `\`${String(p.mmr).padStart(3)}\` | ${p.ignPlain}`);

        return new EmbedBuilder({
            author: { name: `${tierLabel} Active Substitute(s)` },
            description: lines.length > 0 ? lines.join(`\n`) : `*No active substitutes*`,
            color: COLORS[tier],
            footer: { text: `MMR: ${min} - ${max === 999 ? `∞` : max}` },
        });
    });

    return interaction.editReply({ embeds: [titleEmbed, ...tierEmbeds] });
}

module.exports = { activeSubs };
