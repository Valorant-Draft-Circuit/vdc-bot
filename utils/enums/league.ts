/**
 * This file contains the enumerations for the league command's managed buttons.
 * To compile this, type one of the following commands into the root of the project directory
 *
 * @option npm run compile
 * @option tsc ./utils/enums/league.ts
 */

/**
 * @enum {LeagueNavigationOptions} Navigation enumerations for /league confirmation buttons
 */
export enum LeagueNavigationOptions {
    AWARD_FINAL_CONFIRM = 400,
    PICKEM_CONFIRM      = 401,

    CANCEL              = 999,
}
