import { PlayerStatusCode, ContractStatus } from '../utils/enums';
import { PrismaClient } from '@prisma/client';
import { Player } from './_Player';

const prisma = new PrismaClient();

export class Transaction {
    static async updateStatus(options: { playerID: string, status: PlayerStatusCode }) {
        return await prisma.player.update({
            where: { id: options.playerID },
            data: {
                status: options.status
            }
        });
    };

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
    };

    static async cut(playerID: string) {
        return await prisma.player.update({
            where: { id: playerID },
            data: {
                team: null,
                status: PlayerStatusCode.FREE_AGENT,
                contractStatus: ContractStatus.FREE_AGENT,
            }
        })
    };

    static async renew(options: { playerID: string }) {
        return await prisma.player.update({
            where: { id: options.playerID },
            data: {
                contractStatus: ContractStatus.RENEWED,
            }
        })
    };

    static async updateTier(options: { playerID: string, teamID: number }) {
        return await prisma.player.update({
            where: { id: options.playerID },
            data: {
                team: options.teamID,
            }
        })
    };

    static async sub(options: { playerID: string, teamID: number }) {
        const { playerID, teamID } = options;
        return await prisma.player.update({
            where: { id: playerID },
            data: {
                team: teamID,
                contractStatus: ContractStatus.ACTIVE_SUB,
            }
        })
    };

    static async unsub(options: { playerID: string }) {
        const { playerID } = options;
        const player = await Player.getBy({ discordID: playerID });
        return await prisma.player.update({
            where: { id: playerID },
            data: {
                team: null,
                contractStatus: player?.status === PlayerStatusCode.FREE_AGENT ?
                    ContractStatus.FREE_AGENT :
                    ContractStatus.RESTRICTED_FREE_AGENT,
            }
        })
    };

    static async toggleInactiveReserve(options: { playerID: string, toggle: `SET` | `REMOVE` }) {
        const { playerID, toggle } = options;

        const contractStatus = toggle === `SET` ? ContractStatus.INACTIVE_RESERVE : ContractStatus.SIGNED;
        return await prisma.player.update({
            where: { id: playerID },
            data: { contractStatus: contractStatus }
        });
    };

    static async retire(playerID) {
        return await prisma.player.update({
            where: { id: playerID },
            data: {
                team: null,
                status: PlayerStatusCode.FORMER_PLAYER,
                contractStatus: ContractStatus.RETIRED
            }
        });
    };
};