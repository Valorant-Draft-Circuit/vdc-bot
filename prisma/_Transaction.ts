import { prisma } from "./prismadb"

export class Transaction {
    static async cut() {
        return await console.log(`CUT`);
    }
};