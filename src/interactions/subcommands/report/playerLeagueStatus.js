const { LeagueStatus } = require(`@prisma/client`);
const { prisma } = require(`../../../../prisma/prismadb`);

const defaultStatuses = [LeagueStatus.PENDING, LeagueStatus.APPROVED, LeagueStatus.DRAFT_ELIGIBLE, LeagueStatus.FREE_AGENT, LeagueStatus.RESTRICTED_FREE_AGENT, LeagueStatus.SIGNED, LeagueStatus.GENERAL_MANAGER];

module.exports = {
    name: `player-league-status`,
    readable: `Player League Status`,

    helpResponse: [
        `Use the \`Player League Status\` report to get a comprehensive list of the players in the league and their current status. The report will default to only showing players with the following statuses : ${defaultStatuses.map(ls => `\`${ls}\``).join(`, `)}`,
        [
            `Use \`--show-all\` to show all players in the database, regardless of their status`,
            `Use \`--only-<LEAGUE_STATUS>\` to show only players with a specific status. (e.g. \`--only-PENDING\`)`,
        ].map(data => `> ${data}`).join(`\n`),
    ].join(`\n\n`),
    args: [`--show-all`, `--only-<LEAGUE_STATUS>`],

    async generate(args) {
        let out = ``;

        const response = await prisma.status.findMany({ include: { Player: { include: { PrimaryRiotAccount: true } } } });

        // if the arg is "--only", show only the players with the requeseted status
        if (args?.includes(`--only`)) {
            args = args.split(`--only-`)[1];
            const status = LeagueStatus[args.toUpperCase()];
            if (!status) return { text: `Invalid status provided! Got "${args}" but expected one of : ${Object.keys(LeagueStatus).join(`, `)}` };

            const players = response.filter(r => r.leagueStatus == status);

            out += `${`${status} (${players.length})\n`}`;
            out += `${``.padEnd(65, `—`)}\n`;
            out += players.map(p => `${p.Player.name.padEnd(25, ` `)} | ${p.Player?.PrimaryRiotAccount?.riotIGN}`).join(`\n`);

            return { text: out };
        }

        // begin output for default statuses
        for (let i = 0; i < defaultStatuses.length; i++) {
            const status = defaultStatuses[i];

            const players = response.filter(r => r.leagueStatus == status);

            out += `${`${status} (${players.length})\n`}`;
            out += `${``.padEnd(65, `—`)}\n`;
            out += players.map(p => `${p.Player.name.padEnd(25, ` `)} | ${p.Player?.PrimaryRiotAccount?.riotIGN}`).join(`\n`);
            if (i < defaultStatuses.length - 1) out += `\n\n\n\n`;
        }

        // if show all is enabled, show all players
        if (args?.includes(`--show-all`)) {
            const nonDefaultStatuses = Object.keys(LeagueStatus).filter(ls => !defaultStatuses.includes(ls));

            for (let i = 0; i < nonDefaultStatuses.length; i++) {
                const status = nonDefaultStatuses[i];

                const players = response.filter(r => r.leagueStatus == status);

                out += `${`${status} (${players.length})\n`}`;
                out += `${``.padEnd(65, `—`)}\n`;
                out += players.map(p => `${p.Player.name.padEnd(25, ` `)} | ${p.Player?.PrimaryRiotAccount?.riotIGN}`).join(`\n`);
                if (i < nonDefaultStatuses.length - 1) out += `\n\n\n\n`;
            }
        }

        return { text: out };
    }
}