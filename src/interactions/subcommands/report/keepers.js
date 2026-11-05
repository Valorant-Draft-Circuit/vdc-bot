const { Tier, LeagueStatus, ContractStatus } = require(`@prisma/client`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { ControlPanel } = require(`../../../../prisma`);

const center = (str, length) => str.padStart((length + str.length) / 2, ` `).padEnd(length, ` `);


module.exports = {
    name: `keepers`, // this is the name/value of the command
    readable: `Keeper Picks`, // this shows in the selection option

    helpResponse: [
        `Use the \`Keeper Picks\` report to generate a report of all the keeper picks for the draft for a given tier. The report outputs the __lowest round__ keeper picks can be in. Players tied on MMR at a round boundary stay together, so a round can contain more players than there are teams in the tier.\n\nLet's look at the following example:\n- \`PROSPECT\` tier lines are [\`0\`, \`90\`)\n- There are \`10\` teams in prospect\n- Since there are \`10\` teams and \`90\` players, there will be \`9\` rounds\n- Player \`Travestey#7227\` has an MMR of \`75\`\n\nThe **minimum** tier \`Travestey#7227\` can be a keeper in is round \`2\`, but __can__ be a keeper in round \`1\` as well if circumstances call for/require. A franchise CANNOT set a keeper for a round LOWER than their MMR allows.`,
        [
            `**REQUIRED** : Use \`--tier-<TIER>\` to select a single tier to display. (e.g. \`--tier-PROSPECT\`)`
        ].map(data => `> ${data}`).join(`\n`),
    ].join(`\n\n`),
    args: [`--tier-<TIER>`], // this is the list of arguments that can be passed to the command

    // the generator function
    async generate(args) {
        let out = ``;

        // if the arg is "--tier", show only the players with the requested tier
        if (args?.includes(`--tier`)) {
            args = args.split(`--tier-`)[1];
            const tier = Tier[args.toUpperCase()];
            if (!tier) return { text: `Invalid tier provided! Got "${args}" but expected one of : ${Object.keys(Tier).join(`, `)}` };


            out += `Keeper Picks - ${tier}\n`;
            out += `${``.padEnd(65, `—`)}\n\n\n`;

            // get basic info
            const draftableStatuses = [LeagueStatus.DRAFT_ELIGIBLE, LeagueStatus.FREE_AGENT, LeagueStatus.SIGNED, LeagueStatus.GENERAL_MANAGER];
            const tierLines = await ControlPanel.getMMRCaps(`PLAYER`);
            const teams = await prisma.teams.findMany({ where: { active: true } });

            // get all draftable players & filter out non-playing GMs
            const playersWithDraftableStatuses = (await prisma.user.findMany({
                where: {
                    Status: { leagueStatus: { in: draftableStatuses } }
                },
                include: {
                    Status: true,
                    Team: { include: { Franchise: true } },
                    PrimaryRiotAccount: { include: { MMR: true } }
                }
            })).filter(p => !(p.Status.leagueStatus === LeagueStatus.GENERAL_MANAGER && p.Status.contractStatus !== ContractStatus.SIGNED));


            // filter by tier
            const draftableInTier = playersWithDraftableStatuses.filter(p => {
                return p.PrimaryRiotAccount.MMR.mmrEffective >= tierLines[tier].min &&
                    p.PrimaryRiotAccount.MMR.mmrEffective <= tierLines[tier].max;
            });


            // NOTE: THIS IS SORTED IN REVERSE ASCENDING ORDER - HIGHER MMR PLAYERS ARE HIGHER IN THE KEEPER PLACEMENT
            const sortedDraftable = draftableInTier.sort((a, b) => b.PrimaryRiotAccount.MMR.mmrEffective - a.PrimaryRiotAccount.MMR.mmrEffective);

            // get the number of teams in each tier and divide into chunks
            const teamsInTier = teams.filter(t => t.tier === tier).length;
            const roundsDivided = chunkArrayWithTies(
                sortedDraftable,
                teamsInTier,
                player => player.PrimaryRiotAccount.MMR.mmrEffective
            );

            // iterate through every round
            for (let r = 0; r < roundsDivided.length; r++) {
                const round = roundsDivided[r];

                // if it does, add round text and process keepers
                out += `Round ${r + 1}\n`
                out += `${``.padEnd(65, `—`)}\n`;

                // iterate through every player
                for (let p = 0; p < round.length; p++) {
                    const player = round[p];

                    const name = player.name;
                    const mmr = String(player.PrimaryRiotAccount.MMR.mmrEffective).padStart(3, ` `);
                    const ign = player.PrimaryRiotAccount.riotIGN;
                    const slug = (player.team ? player.Team.Franchise.slug : ``).padStart(3, ` `);

                    out += `${center(name, 25)} | ${mmr} | ${slug} | ${ign}\n`;
                }
                if (r < roundsDivided.length - 1) out += `\n\n`;
            }
            return { text: out };
        } else {
            out += `You did not provide a tier. Please provide a tier using "--tier-<TIER>". For help or an example, use "--help".`
        }

        return { text: out };
    }
}

function chunkArrayWithTies(arr, n, getValue) {
    if (n <= 0) throw new Error(`Chunk size must be greater than 0`);
    const result = [];

    for (let start = 0; start < arr.length;) {
        let end = Math.min(start + n, arr.length);

        // Keep players tied with the last player in this round at the same boundary.
        // If there are 14 teams in a tier and the 14th player in Round 1 has an MMR of X, then
        // any subsequent players that also have an MMR of X should be moved up to Round 1, and the
        // positioning of all other players should be moved up.
        if (end < arr.length) {
            const boundaryValue = getValue(arr[end - 1]);
            while (end < arr.length && getValue(arr[end]) === boundaryValue) {
                end++;
            }
        }

        result.push(arr.slice(start, end));
        start = end;
    }

    return result;
}
