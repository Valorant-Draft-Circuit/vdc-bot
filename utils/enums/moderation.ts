/**
 * This file contains the enumerations for the moderation commands.
 * To compile this, type one of the following commands into the root of the project directory 
 * 
 * @option npm run compile
 * @option tsc ./utils/enums/moderation.ts
 */

/**
 * @enum {ModerationNavigationOptions} Navigation Enumerations for moderation commands
 */
export enum ModerationNavigationOptions {
    // High Impact keep on 100 level
    BAN_CONFIRM                 = 100,
    MUTE_CONFIRM                = 111,

    // Low Impact keep on 200 Level
    WARN_CONFIRM                = 200,
    NOTE_CONFIRM                = 222,

    // Everything else
    CANCEL                      = 999,
}