import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const { PlayerStatusCode } = require(`../utils/enums`)

export class Player {

    /** Get all active players in the league */
    static async getAllActive() {
        return await prisma.playerReplica.findMany({
            where: {
                OR: [
                    { isRegistered: PlayerStatusCode.DRAFT_ELIGIBLE },
                    { isRegistered: PlayerStatusCode.FREE_AGENT },
                    { isRegistered: PlayerStatusCode.RESTRICTED_FREE_AGENT },
                    { isRegistered: PlayerStatusCode.SIGNED },
                ]
            }
        })
    };

    static async getAllActiveByTier(tier: "Contender" | "Advanced" | "Master" | "Elite") {
        return await prisma.player.findMany({
            where: {
                OR: [
                    { isRegistered: PlayerStatusCode.DRAFT_ELIGIBLE },
                    { isRegistered: PlayerStatusCode.FREE_AGENT },
                    { isRegistered: PlayerStatusCode.RESTRICTED_FREE_AGENT },
                    { isRegistered: PlayerStatusCode.SIGNED },
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
                    { isRegistered: PlayerStatusCode.FREE_AGENT },
                    { isRegistered: PlayerStatusCode.RESTRICTED_FREE_AGENT }
                ]
            }
        })
    };

    static async getAllSubsByTier(tier: "Contender" | "Advanced" | "Master" | "Elite") {
        return await prisma.player.findMany({
            where: {
                OR: [
                    {
                        AND: {
                            isRegistered: PlayerStatusCode.FREE_AGENT,
                            Team: { tier: tier }
                        }
                    },
                    {
                        AND: {
                            isRegistered: PlayerStatusCode.FREE_AGENT,
                            Team: { tier: tier }
                        }
                    }
                ],

            }
        })
    };

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

        if (ign) return await getPlayerByIGN(ign);
        if (discordID) return await getPlayerByDiscordID(discordID);
        if (riotID) return await getPlayerByRiotID(riotID);
    };
};

/** Query the Player table for a player by their Discord ID
 * @private
 * @param {String} id Discord ID
 */
async function getPlayerByID(id: string) {
    return await prisma.player.findUnique({
        where: { id: id }
    });
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