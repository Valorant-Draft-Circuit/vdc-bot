import { prisma } from "./prismadb"

export class Games {
    static async saveMatch(options: { id: string, type: string }) {
        const { id, type } = options;

        if (!/([a-z0-9]{8})-([a-z0-9]{4}-){3}([a-z0-9]{12})$/.test(id)) throw new Error(`Invalid Match ID!`);

        return await prisma.games.create({
            data: {
                id: id,
                type: type,
                seasonID: 5,
                rounds_played: 1000
            },
        })
    }

    static async exists(options: { id: string }) {
        const match = await prisma.games.findUnique({
            where: { id: options.id }
        })

        return match === null ? false : true;
    }
}
