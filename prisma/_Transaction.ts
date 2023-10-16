import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

import { Franchise, Player, Team } from './index'

export class Transaction {
    static async cut() {
        return await console.log(`CUT`);
    }
};