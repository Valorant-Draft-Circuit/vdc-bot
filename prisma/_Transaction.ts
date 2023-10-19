import { PlayerStatusCode } from '../utils/enums';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type PlayerStatusCodeType =
    PlayerStatusCode.DRAFT_ELIGIBLE | PlayerStatusCode.FREE_AGENT |
    PlayerStatusCode.PENDING | PlayerStatusCode.RESTRICTED_FREE_AGENT |
    PlayerStatusCode.SIGNED | PlayerStatusCode.SUSPENDED |
    PlayerStatusCode.UNREGISTERED;


export class Transaction {
    static async updateStatus(options: { playerID: string, status: PlayerStatusCodeType }) {
        return await prisma.player.update({
            where: { id: options.playerID },
            data: {
                isRegistered: true /** @bug THIS SHOULD ACTUALLY BE @member {options.status} */
            }
        });
    }

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