const { LeagueStatus, Tier } = require(`@prisma/client`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { ControlPanel } = require(`../../../../prisma`);

const compositionStats = {
    MIN: (values) => Math.min(...values),
    MAX: (values) => Math.max(...values),
    MEAN: (values) => values.reduce((a, b) => a + b, 0) / values.length,
    MEDIAN: (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    },
    SDEV: (values) => {
        const mean = compositionStats.MEAN(values);
        const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    },
    "AVG*5": (values) => compositionStats.MEAN(values) * 5,
};

const round = (num) => +num.toFixed(2) === Math.floor(num) ? Math.floor(num) : num.toFixed(2);

module.exports = {
    name: `health`,
    readable: `Health`,

    helpResponse: [
        `Use the \`Health\` report to get glancable information about the health of the league`,
    ].join(`\n\n`),

    async generate() {
        let out = `Health Report\n\n\n`;

        // ###############################################################
        const statuses = await prisma.status.findMany({ select: { leagueStatus: true } });

        out += `League Status Statistics\n`;
        out += `${``.padEnd(65, `—`)}\n`;
        for (let i = 0; i < Object.keys(LeagueStatus).length; i++) {
            const ls = Object.keys(LeagueStatus)[i];
            const players = statuses.filter(r => r.leagueStatus == LeagueStatus[ls]);
            out += `${`${players.length.toString().padStart(5, ` `)} | ${ls}`}`;
            if (i < Object.keys(LeagueStatus).length - 1) out += `\n`;
        }
        // ###############################################################


        // ###############################################################
        out += `\n\n\n\nPlayer Count by Status/Tier\n`;
        out += `${``.padEnd(65, `—`)}\n`;

        // only grab relevant statuses
        const statusesToInclude = [
            LeagueStatus.DRAFT_ELIGIBLE,
            LeagueStatus.FREE_AGENT,
            LeagueStatus.RESTRICTED_FREE_AGENT,
            LeagueStatus.SIGNED,
            LeagueStatus.GENERAL_MANAGER
        ];
        const playerMMRStats = (await prisma.user.findMany({
            where: {
                Status: {
                    leagueStatus: {
                        in: statusesToInclude
                    }
                }
            },
            include: {
                Status: true,
                PrimaryRiotAccount: { include: { MMR: true } },
            }
        })).filter(p => p.PrimaryRiotAccount?.MMR?.mmrEffective != null);

        const tierLines = await ControlPanel.getMMRCaps(`PLAYER`);
        const tiers = Object.keys(Tier).filter(t => t != Tier.MIXED);

        const c1 = statusesToInclude;
        let r1 = [];

        for (let i = 0; i < tiers.length; i++) {
            const filteredByTier = playerMMRStats.filter(p => p.PrimaryRiotAccount.MMR.mmrEffective >= tierLines[tiers[i]].min && p.PrimaryRiotAccount.MMR.mmrEffective <= tierLines[tiers[i]].max);

            let rowTemp = [];
            for (let j = 0; j < statusesToInclude.length; j++) {
                const status = statusesToInclude[j];
                const filteredPlayers = filteredByTier.filter(p => p.Status.leagueStatus == status);

                rowTemp.push(filteredPlayers.length);
            }
            r1.push([tiers[i], ...rowTemp, filteredByTier.length]);
        }

        // cleaned columns (e.g. "RFA" instead of "Restricted Free Agent")
        const cc1 = [...c1.map(c => c.includes(`_`) ? c.split(`_`).map(l => l[0]).join(``) : c), `TOTAL`];

        out += generateTable(cc1, r1);
        out += `\n\nTotal Active Players : ${playerMMRStats.length}`;
        // ###############################################################


        // ###############################################################
        out += `\n\n\n\nTier MMR Statistics\n`;
        out += `${``.padEnd(65, `—`)}\n`;

        const teamCaps = await ControlPanel.getMMRCaps(`TEAM`);

        const flatPlayerMMR = playerMMRStats.map(p => {
            return {
                tier: getTier(p.PrimaryRiotAccount.MMR.mmrEffective, tierLines),
                mmr: p.PrimaryRiotAccount.MMR.mmrEffective
            }
        });

        const c2 = [...Object.keys(compositionStats), `TEAM_CAP`];
        const r2 = [];

        for (let i = 0; i < tiers.length; i++) {
            const tier = tiers[i];
            const filteredByTier = flatPlayerMMR.filter(p => p.tier == Tier[tier]);

            const rowTemp = [];
            for (let j = 0; j < c2.length - 1; j++) {
                const stat = c2[j];
                const filteredPlayers = filteredByTier.map(p => p.mmr);
                rowTemp.push(round(compositionStats[stat](filteredPlayers)));
            }

            r2.push([tier, ...rowTemp, teamCaps[tier]]);
        }

        out += generateTable(c2, r2);
        // ###############################################################


        // ###############################################################
        return { text: out };
    }
}

function generateTable(columns, rows) {
    // Calculate column widths (including the row header)
    const allRows = rows.map(row => [row[0], ...row.slice(1)]);
    const headerRow = ['', ...columns];
    const fullData = [headerRow, ...allRows];

    const colWidths = headerRow.map((_, colIndex) => {
        return Math.max(...fullData.map(row => String(row[colIndex] || '').length));
    });

    // Helper to center-align text
    function centerText(text, width) {
        const str = String(text);
        const totalPadding = width - str.length;
        const leftPadding = Math.floor(totalPadding / 2);
        const rightPadding = totalPadding - leftPadding;
        return ' '.repeat(leftPadding) + str + ' '.repeat(rightPadding);
    }

    // Format a row with centered cells
    function formatRow(rowData) {
        return rowData.map((cell, i) => centerText(cell, colWidths[i])).join('  ');
    }

    // Format the header and body
    const formattedHeader = formatRow(headerRow);
    const formattedRows = rows.map(row => formatRow(row));

    return [formattedHeader, ...formattedRows].join('\n');
}

// get tier based on MMR
function getTier(mmr, tierLines) {

    if ( 											// PROSPECT
        tierLines.PROSPECT.min <= mmr &&
        mmr <= tierLines.PROSPECT.max
    ) {
        return Tier.PROSPECT;
    } else if ( 									// APPRENCICE
        tierLines.APPRENTICE.min <= mmr &&
        mmr <= tierLines.APPRENTICE.max
    ) {
        return Tier.APPRENTICE;
    } else if ( 									// EXPERT
        tierLines.EXPERT.min <= mmr &&
        mmr <= tierLines.EXPERT.max
    ) {
        return Tier.EXPERT;
    } else if ( 									// MYTHIC
        tierLines.MYTHIC.min <= mmr &&
        mmr <= tierLines.MYTHIC.max
    ) {
        return Tier.MYTHIC;
    }
}
