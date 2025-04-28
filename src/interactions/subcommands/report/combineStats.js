const { GameType, Tier } = require(`@prisma/client`);
const { ControlPanel } = require(`../../../../prisma`);
const { prisma } = require(`../../../../prisma/prismadb`);

module.exports = {
    name: `combine-stats`,
    readable: `Combine Statistics`,

    helpResponse: [
        `Use the \`Player League Status\` report to get a comprehensive list of the players in the league and their current status. The report`,
        [
            `Use \`--season-<number>\` to get combine statistics for a given season (e.g. \`--season-8\`). Defaults to the current season.`,
        ].map(data => `> ${data}`).join(`\n`),
    ].join(`\n\n`),
    args: [`--season-<number>`],

    async generate(args) {

        // get season, default to current
        // let season = await ControlPanel.getSeason();
        let season = 0;
        if (args?.includes(`--season`)) {
            if (args.split(`--season-`)[1] == undefined || !args.split(`--season-`)[1].match(/^\d$/)) {
                return { text: `Error: The --season argument given was invalid. Expected a number, got "${args.replace(/--season/g, ``)}"` };
            } else {
                season = Number(args.split(`--season-`)[1])
            }
        } else {
            season = await ControlPanel.getSeason();
        }

        // begin the report heading
        let out = `Season ${season} Combine Statistics\n`;
        out += `${``.padEnd(65, `—`)}\n\n`;

        // get games for the requested season
        const combineGames = await prisma.games.findMany({ where: { season: season, gameType: GameType.COMBINE } });

        // totals
        out += `Combine Totals\n`;
        out += `${``.padEnd(30, `—`)}\n\n`;
        for (const tier in Tier) {
            const tierCombines = combineGames.filter(cg => cg.tier == tier).length;
            if (tierCombines !== 0) out += ` ${tier.padStart(15)} : ${combineGames.filter(cg => cg.tier == tier).length}\n`
        }
        out += `\n\n`;

        // sort by day
        const grouped = groupByDay(combineGames, -6);

        // day by day output
        out += `Combines by Day\n`;
        out += `${``.padEnd(30, `—`)}\n\n`;
        Object.keys(grouped).sort((a, b) => {
            return new Date(a) - new Date(b);
        }).forEach(dateHeading => {

            out += `${dateHeading.padStart(((28 - dateHeading.length) / 2) + dateHeading.length, ` `).padEnd(28, ` `)}\n`
            out += ``.padStart(28, `-`) + `\n`;
            const tiers = grouped[dateHeading];

            for (const tier in Tier) {
                if (tiers[tier]) out += `${tier.padStart(15, ` `)} : ${tiers[tier]}\n`;
            }
            out += `\n`
        });

        return { text: out };
    }
}


function groupByDay(data, timezoneOffsetHours = -6) {
    const result = {};
    const shiftMap = {
        2: -1, // Tuesday → Monday
        4: -1, // Thursday → Wednesday
        6: -1, // Saturday → Friday
        0: -2  // Sunday → Friday
    };

    data.forEach(game => {
        const utcDate = new Date(game.datePlayed);
        const localTime = new Date(utcDate.getTime() + timezoneOffsetHours * 60 * 60 * 1000);
        const originalDay = localTime.getDay()
        const shiftDays = shiftMap[originalDay] || 0;

        // clear time
        const shiftedDate = new Date(localTime);
        shiftedDate.setDate(shiftedDate.getDate() + shiftDays);
        shiftedDate.setHours(0, 0, 0, 0);


        // MWF only
        const allowedDays = [1, 3, 5];
        const shiftedDay = shiftedDate.getDay();
        if (!allowedDays.includes(shiftedDay)) return;

        const options = { weekday: `long`, month: `long`, day: `numeric` };
        const heading = shiftedDate.toLocaleDateString(`en-US`, options)
        const tier = game.tier || `Unknown`;

        if (!result[heading]) result[heading] = {};
        if (!result[heading][tier]) result[heading][tier] = 0;

        result[heading][tier]++;
    });

    return result;
}
