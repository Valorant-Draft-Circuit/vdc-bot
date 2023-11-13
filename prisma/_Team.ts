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


        if (id) return await getTeamByID(id);
        if (name) return await getTeamByName(name);
        if (playerID) return await getTeamByPlayerID(playerID);

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
            include: { Account: true }
        });
    }
}

async function getTeamByID(id: number) {
    return await prisma.team.findUnique({
        where: { id: id }
    })
}

async function getTeamByName(name: string) {
    return await prisma.team.findUnique({
        where: { name: name }
    })
}

async function getTeamByPlayerID(id: string) {
    const player = await prisma.player.findUnique({
        where: { id: id }
    });

    if (player == null) return undefined;
    if (player.team == null) return undefined;
    return await getTeamByID(player.team);
}

async function getRosterByTeamID(id: number) {
    return await prisma.player.findMany({
        where: {
            team: id,
        }
    })
}

async function getRosterByTeamName(name: string) {
    const team = await getTeamByName(name);

    if (team == null) return undefined;
    return await prisma.player.findMany({
        where: {
            team: team.id,
        }
    })
}