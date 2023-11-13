/**
 * This file contains the enumerations for the player status codes
 * To compile this, type one of the following commands into the root of the project directory 
 * 
 * @option npm run compile
 * @option tsc ./utils/enums/playerStatusCodes.ts
 */

/**
 * @enum {Status} The player's Status
 * @param {String} DRAFT_ELIGIBLE Role ID for the Draft Eligible Status
 * @param {String} FREE_AGENT Role ID for the Free Agent Status
 * @param {String} RESTRICTED_FREE_AGENT Role ID for the Restricted Free Agent Status
 * @param {String} INACTIVE_RESERVE Role ID for the Inactive Reserve Status
 */
export enum Status {
    DRAFT_ELIGIBLE = "963568945959419905",
    FREE_AGENT = "963343035683455007",
    RESTRICTED_FREE_AGENT = "965817407094530068",
    INACTIVE_RESERVE = "976541355625025536",

    /** @note - Additional Roles here */
    // ELITE_FREE_AGENT = "1028478484349206572",
    // MASTERS_FREE_AGENT = "1028478833055240243",
    // ADVANCED_FREE_AGENT = "1028478841611620463",
    // CONTENDER_FREE_AGENT = "1028478846753837106",
}


/**
 * @enum {Tier} Enumerations for the tier roles
 * @param {String} ELITE Role ID for the elite tier
 * @param {String} MASTER Role ID for the master tier
 * @param {String} ADVANCED Role ID for the advanced tier
 * @param {String} CONTENDER Role ID for the contender tier
 */

export enum Tier {
    ELITE = "967698140612395018",
    MASTER = "967697939772354600",
    ADVANCED = "973344710540271666",
    CONTENDER = "966106018796941392",
}

export const ROLES = process.env.ENVIRONMENT == "DEV" ?
    /** @development */
    {
        LEAGUE: {
            VIEWER: "1062105398108225556",
            LEAGUE: "1057161314201518091",
            INACTIVE: "1060751264088080445",
            DRAFT_ELIGIBLE: "1057161198702952508",
            FREE_AGENT: "1057161311651377183",
            RESTRICTED_FREE_AGENT: "1057163956524949534",
            INACTIVE_RESERVE: "1060751264088080445", /** @TODO - INVESTIGATE: THIS ROLE ID IS WRONG */
            CAPTAIN: "1082176642329346110",
        },
        TIER: {
            MYTHIC: "1057161199659257928",
            EXPERT: "1057161297319440485",
            APPRENTICE: "1057161301102698567",
            PROSPECT: "1057161308535005204",
        }
    } :
    /** @production */
    {
        LEAGUE: {
            VIEWER: "963665382873391135",
            LEAGUE: "966901006652833862",
            INACTIVE: "1060750208746668132",
            DRAFT_ELIGIBLE: "963568945959419905",
            FREE_AGENT: "963343035683455007",
            RESTRICTED_FREE_AGENT: "965817407094530068",
            INACTIVE_RESERVE: "1060750208746668132", /** @TODO - INVESTIGATE: THIS ROLE ID IS WRONG */
            CAPTAIN: "963863666464268328",
        },
        TIER: {
            MYTHIC: "967698140612395018",
            EXPERT: "967697939772354600",
            APPRENTICE: "973344710540271666",
            PROSPECT: "966106018796941392",
        }
    };