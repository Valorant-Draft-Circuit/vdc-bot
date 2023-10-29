import { PlayerStatusCode, ContractStatus } from '../utils/enums';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class Transaction {
    static async updateStatus(options: { playerID: string, status: PlayerStatusCode }) {
        return await prisma.player.update({
            where: { id: options.playerID },
            data: {
                status: options.status
            }
        });
    }

    static async sign(options: { playerID: string, teamID: number }) {
        const { playerID, teamID } = options;
        return await prisma.player.update({
            where: { id: playerID },
            data: {
                team: teamID,
                status: PlayerStatusCode.SIGNED,
                contractStatus: ContractStatus.SIGNED,
            }
        })
    }

    static async cut(playerID: string) {
        return await prisma.player.update({
            where: { id: playerID },
            data: {
                team: null,
                status: PlayerStatusCode.FREE_AGENT,
                contractStatus: ContractStatus.FREE_AGENT,
            }
        })
    }

    static async renew(options: { playerID: string }) {
        return await prisma.player.update({
            where: { id: options.playerID },
            data: {
                contractStatus: ContractStatus.RENEWED,
            }
        })
    }
};