/**
 * @instructions
 * To compile this file, type in the following command into the root of the project directory
 * tsc ./utils/enums/transactions.ts
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
 * @enum {TransactionsSubTypes} - Enumerations for the cut commands
 */
export enum TransactionsCutOptions {
    /** @param {enum} CONFIRM - Confirm cut enumeration */
    CONFIRM = 201,
    /** @param {enum} CANCEL - Cancel cut enumeration */
    CANCEL = 202,
}