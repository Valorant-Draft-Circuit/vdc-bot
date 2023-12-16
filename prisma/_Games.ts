import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class Games {
    static async saveMatch(options: { id: string, type: string }) {
        const { id, type } = options;

        if (!/([a-z0-9]{8})-([a-z0-9]{4}-){3}([a-z0-9]{12})$/.test(id)) throw new Error(`Invalid Match ID!`);
        fetch(`https://numbers.vdc.gg/game/season/process`, { method: `PUT` });
        return await prisma.games.create({
            data: {
                id: id,
                type: type,
                seasonID: 5,
                rounds_played: 1000
            },
        })
    };

    static async exists(options: { id: string }) {
        const { id } = options;
        if (!/([a-z0-9]{8})-([a-z0-9]{4}-){3}([a-z0-9]{12})$/.test(id)) throw new Error(`Invalid Match ID!`);

        const match = await prisma.games.findUnique({
            where: { id: id }
        })

        return match === null ? false : true;
    };

    static async getMatchData(options: { id: string }) {
        const { id } = options;

        if (!/([a-z0-9]{8})-([a-z0-9]{4}-){3}([a-z0-9]{12})$/.test(id)) throw new Error(`Invalid Match ID!`);
        return await prisma.games.findFirst({
            where: { id: id },
            include: { PlayerStats: { include: { Player: { include: { Account: true, Team: true } } } } }
        });

    };

    static async getAllBy(options: {
        type?: `Combine` | `Season`,
        tier?: `Prospect` | `Advanced` | `Expert` | `Mythic`,
        franchise?: number,
        team?: number,
    }) {
        const { type, tier, franchise, team } = options;
        const gameType = type !== undefined && tier !== undefined ? `${type} - ${tier}` : undefined;

        return await prisma.games.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { type: { equals: gameType } },
                            { Team_Games_team1ToTeam: { franchise: franchise } },
                            { Team_Games_team2ToTeam: { franchise: franchise } },
                            { team1: team },
                            { team2: team },
                        ]
                    },
                    { date_played: { not: null } },
                    { team1: { not: null } },
                    { team2: { not: null } },
                    { winner: { not: null } },
                ]
            }
        });
    }
}
