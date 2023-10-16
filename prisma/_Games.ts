import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class Games {
    static async store(options: { id: String, type: String }) {
        return await prisma.games.create({
            data: {
                id: id,
                type: type,
                seasonID: 5,
            },
        })
    }
}
