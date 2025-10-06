/**
 * This file contains the enumerations for the player status codes
 * To compile this, type one of the following commands into the root of the project directory 
 * 
 * @option npm run compile
 * @option tsc ./utils/enums/playerStatusCodes.ts
 */

/**
 * @enum {PlayerStatusCode} Enumerations for the player status codes
 * @param {Number} UNREGISTERED Player is unregistered
 * @param {Number} PENDING Player is pending acceptence to the league
 * @param {Number} DRAFT Player is eligible to be drafted (DE)
 * @param {Number} FREE Player is a free agent (FA)
 * @param {Number} RESTRICTED Player is a restricted free agent (RFA)
 * @param {Number} SUSPENDED Player is suspended from the league
 * @param {Number} SIGNED Player is signed to a franchise
 */
export enum PlayerStatusCode {
    UNREGISTERED = 0,
    PENDING = 1,
    DRAFT_ELIGIBLE = 2,
    FREE_AGENT = 3,
    RESTRICTED_FREE_AGENT = 4,
    SUSPENDED = 5,
    SIGNED = 6,
    FORMER_PLAYER = 7,
};

/**
 * @enum {ContractStatus} Enumerations for the player contract status
 * @param {Number} SIGNED Player is signed
 * @param {Number} MID_CONTRACT Player is mid contract (1 season left)
 * @param {Number} DRAFT_ELIGIBLE Player is eligible to be drafted (DE)
 * @param {Number} FREE_AGENT Player is a free agent (FA)
 * @param {Number} RESTRICTED_FREE_AGENT Player is a restricted free agent (RFA)
 * @param {Number} GM_SIGNED GM is signed to a team within the franchise
 * @param {Number} GM_UNSIGNED GM is NOT signed to a team within the franchise
 * @param {Number} RENEWED Player's contract was renewed (1 season left)
 */
export enum ContractStatus {
    SIGNED = 0,
    MID_CONTRACT = 1,
    EXPIRING = 2,
    DRAFT_ELIGIBLE = 3,
    FREE_AGENT = 4,
    RESTRICTED_FREE_AGENT = 5,
    GM_SIGNED = 6,
    GM_UNSIGNED = 7,
    RENEWED = 8,
    INACTIVE_RESERVE = 9,
    ACTIVE_SUB = 10,
    RETIRED = 11,
}