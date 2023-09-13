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
    DRAFT = 2,
    FREE = 3,
    RESTRICTED = 4,
    SUSPENDED = 5,
    SIGNED = 6
}
