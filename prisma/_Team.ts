import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const { PlayerStatusCode } = require(`../utils/enums`)

export class Team {

    /**
     * Get a team by a specific option
     * @param {Object} option
     * @param {?Number} option.id
     * @param {?String} option.name
     * @param {?String} option.playerID
     */
    static async getBy(option: { id?: number; name?: string; playerID?: string; }) {
        if (option == undefined) return new Error(`Must specify exactly 1 option!`);
        const { id, name, playerID } = option;

        if (Object.keys(option).length > 1) throw new Error(`Must specify exactly 1 option!`);

        return await prisma.team.findFirst({
            where: {
                OR: [
                    { id: id }, { name: name },
                    // { Player: { some: { id: playerID } } }
                ]
            }
        });
    };

    static async getRosterBy(option: { id?: number; name?: string; }) {
        if (option == undefined) return new Error(`Must specify exactly 1 option!`);
        if (Object.keys(option).length > 1) throw new Error(`Must specify exactly 1 option!`);

        const { id, name } = option;

        return await prisma.player.findMany({
            where: {
                OR: [
                    { Team: { name: name } },
                    { team: id },
                ]
            },
            include: { Account: true, MMR_Player_MMRToMMR: true }
        });
    };

    static async getAllActiveByTier(tier: `Prospect` | `Advanced` | `Expert` | `Mythic`) {
        return await prisma.team.findMany({
            where: { AND: [{ tier: tier }, { isActive: true }] },
            include: { Franchise: true }
        })
    };
}
