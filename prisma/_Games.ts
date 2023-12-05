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
}
