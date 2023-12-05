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
    CONFIRM_SUB = 101,
    CONFIRM_UNSUB = 102,
    CANCEL = 199,
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
 * @enum {TransactionsSignOptions} - Enumerations for the cut commands
 */
export enum TransactionsSignOptions {
    /** @param {enum} CONFIRM - Confirm cut enumeration */
    CONFIRM = 301,
    /** @param {enum} CANCEL - Cancel cut enumeration */
    CANCEL = 302,
}

/**
 * @enum {TransactionsIROptions} - Enumerations for the ir commands
 */
export enum TransactionsIROptions {
    /** @param {enum} CONFIRM - Confirm cut enumeration */
    CONFIRM_SET = 401,
    CONFIRM_REMOVE = 402,
    /** @param {enum} CANCEL - Cancel cut enumeration */
    CANCEL = 499,
}

/**
 * @enum {TransactionsDraftSignOptions} - Enumerations for the ir commands
 */
export enum TransactionsDraftSignOptions {
    /** @param {enum} CONFIRM - Confirm cut enumeration */
    CONFIRM = 501,
    /** @param {enum} CANCEL - Cancel cut enumeration */
    CANCEL = 502,
}


/**
 * @enum {TransactionsRenewOptions} - Enumerations for the ir commands
 */
export enum TransactionsRenewOptions {
    /** @param {enum} CONFIRM - Confirm cut enumeration */
    CONFIRM = 601,
    /** @param {enum} CANCEL - Cancel cut enumeration */
    CANCEL = 602,
}

/**
 * @enum {TransactionsUpdateTierOptions} - Enumerations for the ir commands
 */
export enum TransactionsUpdateTierOptions {
    /** @param {enum} CONFIRM - Confirm cut enumeration */
    CONFIRM = 701,
    /** @param {enum} CANCEL - Cancel cut enumeration */
    CANCEL = 702,
}

/**
 * @enum {TransactionsSwapOptions} - Enumerations for the ir commands
 */
export enum TransactionsSwapOptions {
    /** @param {enum} CONFIRM - Confirm cut enumeration */
    CONFIRM = 801,
    /** @param {enum} CANCEL - Cancel cut enumeration */
    CANCEL = 899,
}