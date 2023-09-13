/**
 * This file contains the enumerations for the transaction commands.
 * To compile this, type one of the following commands into the root of the project directory 
 * 
 * @option npm run compile
 * @option tsc ./utils/enums/transactions.ts
 */

/**
 * @enum {TransactionsSubTypes} Enumerations for the sub commands
 */
export enum TransactionsSubTypes {
    /** @param {Number} FRANCHISE - Franchise enumeration */
    FRANCHISE = 101,
    /** @param {Number} TEAM - Team enumeration */
    TEAM = 102,
    /** @param {Number} PLAYER - Player enumeration */
    PLAYER = 103,
}

/**
 * @enum {TransactionsCutOptions} - Enumerations for the cut commands
 */
export enum TransactionsCutOptions {
    /** @param {enum} CONFIRM - Confirm cut enumeration */
    CONFIRM = 201,
    /** @param {enum} CANCEL - Cancel cut enumeration */
    CANCEL = 202,
}

/**
 * @enum {TransactionsIROptions} - Enumerations for the ir commands
 */
export enum TransactionsIROptions {
    /** @param {enum} CONFIRM - Confirm cut enumeration */
    CONFIRM = 301,
    /** @param {enum} CANCEL - Cancel cut enumeration */
    CANCEL = 302,
}