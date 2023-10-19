import { PlayerStatusCode } from '../utils/enums';

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// import { Franchise, Player, Team } from './index'
import { Player } from "./_Player";

export class Transaction {
    static async sign(options: { playerID: string, teamID: number }) {
        const { playerID, teamID } = options;
        return await prisma.player.update({
            where: { id: playerID },
            data: {
                team: teamID,
                isRegistered: true /** @bug THIS SHOULD ACTUALLY BE @member {PlayerStatusCode.SIGNED} */
            }
        })
    }

    static async cut(playerID: string) {
        return await prisma.player.update({
            where: { id: playerID },
            data: {
                team: null,
                isRegistered: true /** @bug THIS SHOULD ACTUALLY BE @member {PlayerStatusCode.FREE_AGENT} */
            }
        })
    }
};