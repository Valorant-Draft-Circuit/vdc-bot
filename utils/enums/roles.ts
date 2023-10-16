/**
 * This file contains the enumerations for the player status codes
 * To compile this, type one of the following commands into the root of the project directory 
 * 
 * @option npm run compile
 * @option tsc ./utils/enums/playerStatusCodes.ts
 */

/**
 * @enum {Franchise} Enumerations for the franchise roles
 * @param {String} IE Ignium Esports
 * @param {String} VTX Infinite Vortex
 * @param {String} KC Kingdom Coffee
 * @param {String} LG Light Garden
 * @param {String} L7 Lucky Sevens
 * @param {String} OS Omnipotent Sandwiches
 * @param {String} TT DoubleTaps
 * @param {String} ATO The Automata
 * @param {String} PA Party Animals
 * @param {String} MF The Mafia
 * @param {String} SOL Solaris
 * @param {String} PPI Post Plant Incorporated 
 */

export enum Franchise {
    IE = "969642817397850112",
    VTX = "970712837003563048",
    KC = "971546196407635999",
    LG = "968755818231128114",
    L7 = "966395530211127396",
    OS = "968018582934024262",
    TT = "966904182223290488",
    ATO = "963905820351946764",
    PA = "963905754711076906",
    MF = "971546122160062474",
    SOL = "970713326709514250",
    PPI = "966904250615599163",
}


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
