/**
 * This file contains the enumerations for the transaction commands.
 * To compile this, type one of the following commands into the root of the project directory 
 * 
 * @option npm run compile
 * @option tsc ./utils/enums/transactions.ts
 */

/**
 * @enum {ButtonOptions} Enumerations for button managers (Generally used for confirm/cancel buttons)
 */
export enum ButtonOptions {
    /** @param {Number} CANCEL - General enum to cancel an operation or function */
    CANCEL = 999,


    /** @param {Number} ACTIVITY_CONFIRM - Confirm enum for /setup activity-check command */
    ACTIVITY_CONFIRM = 101,
}