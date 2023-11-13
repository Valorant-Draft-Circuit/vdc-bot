import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class Franchise {

    /** Get all active franchises */
    static async getAllActive() {
        return await prisma.franchise.findMany({
            where: { isActive: true, },
            include: { Team: true }
        });
    };

    /** Get ALL of a franchise's teams (Must specify one paramater)
     * @param option Option to filter franchises by
     */
    static async getTeams(option: {
        id?: number;
        name?: string;
        slug?: string;
    }) {

        if (option == undefined) throw new Error(`Must specify at least 1 option!`);
        const { id, name, slug } = option;

        if (Object.keys(option).length > 1) throw new Error(`Must specify only 1 option!`);

        let franchise: { id?: number; name?: string; slug?: string; logoFileName?: string | null; isActive?: boolean; } | null = {};

        if (id) franchise = await getFranchiseByID(id);
        if (name) franchise = await getFranchiseByName(name);
        if (slug) franchise = await getFranchiseBySlug(slug);

        if (franchise == null) return undefined;

        return await prisma.team.findMany({
            where: { franchise: franchise.id, isActive: true },
        });
    };

    /** Get a franchise by a specific option
     * @param {Object} option
     * @param {?string} option.slug
     * @param {?string} option.teamName
     * @param {?number} option.franchiseID
     * @param {?number} option.teamID
     */
    static async getBy(option: {
        id?: number;
        name?: string;
        slug?: string;
        teamID?: number;
        teamName?: string;
    }) {
        if (option == undefined) return new Error(`Must specify exactly 1 option!`);
        const { id, name, slug, teamID, teamName } = option;

        if (Object.keys(option).length > 1) throw new Error(`Must specify exactly 1 option!`);

        if (id) return await getFranchiseByID(id);
        if (name) return await getFranchiseByName(name);
        if (slug) return await getFranchiseBySlug(slug);
        if (teamID) return await getFranchiseByTeamID(teamID);
        if (teamName) return await getFranchiseByTeamName(teamName);

    };
}

/** Get a franchise by it's id
 * @param id Franchise ID
 * @returns 
 */
async function getFranchiseByID(id: number) {
    return await prisma.franchise.findUnique({
        where: { id: id }
    })
}

/** Get a franchise by it's name
 * @param {number} name The franchise's name (i.e. Solaris)
 */
async function getFranchiseByName(name: string) {
    return await prisma.franchise.findFirst({
        where: { name: name }
    })
}

/** Get a franchise by it's slug
 * @param {string} slug The franchise's slug (i.e. SOL, OS, etc.)]
 */
async function getFranchiseBySlug(slug: string) {
    return await prisma.franchise.findUnique({
        where: { slug: slug }
    });
}

/** Get a franchise by the name of one of it's teams
 * @param id Team ID
 */
async function getFranchiseByTeamID(teamID: number) {
    const id = await prisma.team.findUnique({
        where: { id: teamID },
        select: { franchise: true }
    });

    if (id == null) return undefined;
    return await getFranchiseByID(id.franchise)
}

/** Get a franchise by the name of one of it's teams
 * @param name Team name
 */
async function getFranchiseByTeamName(teamName: string) {
    const id = await prisma.team.findUnique({
        where: { name: teamName },
        select: { franchise: true }
    });

    if (id == null) return undefined;
    return await getFranchiseByID(id.franchise)
}

