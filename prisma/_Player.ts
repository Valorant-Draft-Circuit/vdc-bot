import { PlayerStatusCode } from '../utils/enums';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export class Player {

    /** Get all active players in the league */
    static async getAllActive() {
        return await prisma.player.findMany({
            where: {
                OR: [
                    { status: PlayerStatusCode.DRAFT_ELIGIBLE },
                    { status: PlayerStatusCode.FREE_AGENT },
                    { status: PlayerStatusCode.RESTRICTED_FREE_AGENT },
                    { status: PlayerStatusCode.SIGNED },
                ]
            }
        })
    };

    static async getAllActiveByTier(tier: "Prospect" | "Apprentice" | "Expert" | "Mythic") {
        return await prisma.player.findMany({
            where: {
                OR: [
                    { status: PlayerStatusCode.DRAFT_ELIGIBLE },
                    { status: PlayerStatusCode.FREE_AGENT },
                    { status: PlayerStatusCode.RESTRICTED_FREE_AGENT },
                    { status: PlayerStatusCode.SIGNED },
                ],
                Team: {
                    tier: tier
                }
            }
        })
    };

    /** Get all substitutes */
    static async getAllSubs() {
        return await prisma.player.findMany({
            where: {
                OR: [
                    { status: PlayerStatusCode.FREE_AGENT },
                    { status: PlayerStatusCode.RESTRICTED_FREE_AGENT }
                ]
            }
        })
    };

    static async getAllSubsByTier(tier: "Prospect" | "Apprentice" | "Expert" | "Mythic") {
        return await prisma.player.findMany({
            where: {
                OR: [
                    {
                        AND: {
                            status: PlayerStatusCode.FREE_AGENT,
                            Team: { tier: tier }
                        }
                    },
                    {
                        AND: {
                            status: PlayerStatusCode.FREE_AGENT,
                            Team: { tier: tier }
                        }
                    }
                ],

            }
        })
    };

    static async getInfoBy(option: { name?: string; discordID?: string; riotID?: string; } | undefined) {
        const player = await this.getBy(option);
        if (player == null) return undefined;

        const unflattenedData = await prisma.player.findUnique({
            where: { id: player.id },
            include: {
                Team: {
                    include: {
                        Franchise: true
                    }
                }
            }
        });

        const flattenedData: { team?: any | { Franchise?: any }, franchise: any } = {
            ...player,
            team: unflattenedData?.Team,
            franchise: unflattenedData?.Team?.Franchise
        };
        delete flattenedData.team?.Franchise;

        return flattenedData;
    }

    /** Get a player's stats by a specific option (Must include at least one)
     * @param {Object} option
     * @param {?Number} option.name
     * @param {?String} option.discordID
     * @param {?String} option.riotID
     */
    static async getStatsBy(option: { name?: string; discordID?: string; riotID?: string; } | undefined) {

        if (option == undefined) throw new Error(`Must specify exactly 1 option!`);
        const { name, discordID, riotID } = option;

        if (Object.keys(option).length > 1) throw new Error(`Must specify exactly 1 option!`);
    };

    static async getIGNby(option: { discordID: string; }) {
        const playerAccount = await prisma.player.findFirst({
            where: { id: option.discordID },
            include: { Account: true }
        })

        return playerAccount?.Account?.riotID;
    }

    static async updateRiotID(option: {puuid: string; newRiotID: string;}) {
        const { puuid, newRiotID } = option;
        console.log(option)
        if (Object.keys(option).length != 2) throw new Error(`Must specify both options!`);

        return await prisma.account.update({
          where: { providerAccountId: puuid },
          data: { riotID: newRiotID }
        });
    }

    /** Get a user by a specific option
     * @param {Object} option
     * @param {?Number} option.ign
     * @param {?String} option.discordID
     * @param {?String} option.riotID
     */
    static async getBy(option: { ign?: string; discordID?: string; riotID?: string; } | undefined) {
        if (option == undefined) throw new Error(`Must specify exactly 1 option!`);
        const { ign, discordID, riotID } = option;

        if (Object.keys(option).length > 1) throw new Error(`Must specify exactly 1 option!`);

        if (discordID !== undefined) return await getPlayerByDiscordID(discordID);

        return await prisma.player.findFirst({
            where: {
                OR: [
                    { Account: { riotID: ign } },
                    { Account: { providerAccountId: riotID } },
                ]
            },
            include: { Account: true }
        });
    };

    static async updateBy(option: {
        userIdentifier: { ign?: string; discordID?: string; riotID?: string; },
        updateParamaters: { teamID: number, status: number, contractStatus: number, MMR: number }
    }) {
        const player = await this.getBy(option.userIdentifier);
        if (!player) return new Error(`Could not find that player in the database!`);

        return await prisma.player.update({
            where: { id: player.id },
            data: option.updateParamaters
        });
    }
};

/** Query the Player table for a player by their Discord ID
 * @private
 * @param {String} id Discord ID
 */
async function getPlayerByID(id: string) {
    const a = await prisma.player.findUnique({
        where: { id: id },
        include: { Account: true }
    });

    if (a == null) return undefined
    else return a;
}

/** Query the Player table for a player by their IGN
 * @private
 * @param {String} ign Valorant IGN
 */
async function getPlayerByIGN(ign: any) {
    return await prisma.player.findFirst({
        where: {
            Account: {
                riotID: ign
            }
        }
    });
}

/** Query the Account table for a player by their Discord ID
 * @private
 * @param {String} id Discord ID
 */
async function getPlayerByDiscordID(id: string) {
    const playerDiscordAccount = await prisma.account.findFirst({
        where: {
            AND: [
                { provider: `discord` },
                { providerAccountId: id },
            ]
        },
    });

    if (playerDiscordAccount == null) return undefined;
    return await getPlayerByID(playerDiscordAccount.providerAccountId);
}

/** Query the Account table for a player by their Riot ID
 * @private
 * @param id Discord ID
 */
async function getPlayerByRiotID(id: string) {
    const playerRiotAccount = await prisma.account.findFirst({
        where: {
            AND: [
                { provider: `riot` },
                { providerAccountId: id },
            ]
        }
    });

    if (playerRiotAccount == null) return undefined;
    const playerDiscordAccount = await prisma.account.findFirst({
        where: {
            AND: [
                { provider: `discord` },
                { userId: playerRiotAccount.userId },
            ]
        },
    });

    if (playerDiscordAccount == null) return undefined;
    return await getPlayerByID(playerDiscordAccount.providerAccountId);
}

function validateProperties(object: Object, validProperties: [String]) {
    const objectProperties = Object.keys(object);

    for (const property in objectProperties) {
        if (!validProperties.includes(property)) throw new Error(`Invalid property!`);
    }
}