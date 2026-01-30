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
    EXPIRE_COMFIRM              = 106,
    RESCHEDULE_CONFIRM          = 107,
    SCHEDULE_PLAYOFF_CONFIRM    = 108,

    IR_SET_COMFIRM              = 200,
    IR_REMOVE_COMFIRM           = 201,

    CAPTAIN_SET_COMFIRM         = 202,
    CAPTAIN_REMOVE_COMFIRM      = 203,

    SUB_CONFIRM                 = 210,
    UNSUB_CONFIRM               = 211,

    TRADE_CONFIRM               = 220,
    TRADE_RESET                 = 221,
    TRADE_F1P                   = 222, // Show franchise 1's players
    TRADE_F2P                   = 223, // Show franchise 2's players
    TRADE_F1DP                  = 224, // Show franchise 1's draft picks
    TRADE_F2DP                  = 225, // Show franchise 2's draft picks

    CANCEL                      = 999,
}