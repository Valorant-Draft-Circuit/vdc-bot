/**
 * This file contains the enumerations for the transaction commands.
 * To compile this, type one of the following commands into the root of the project directory 
 * 
 * @option npm run compile
 * @option tsc ./utils/enums/transactions.ts
 */

/**
 * @enum {TransactionsNavigationOptions} Navigation Enumerations for Transactions commands
 */
export enum TransactionsNavigationOptions {
    CUT_CONFIRM                 = 100,
    SIGN_COMFIRM                = 101,
    RENEW_COMFIRM               = 102,
    DRAFT_SIGN_COMFIRM          = 103,
    UPDATE_TIER_COMFIRM         = 104,
    RETIRE_COMFIRM              = 105,
    SWAP_COMFIRM                = 106,

    IR_SET_COMFIRM              = 200,
    IR_REMOVE_COMFIRM           = 201,

    SUB_CONFIRM                 = 210,
    UNSUB_CONFIRM               = 211,

    CANCEL                      = 999,
}