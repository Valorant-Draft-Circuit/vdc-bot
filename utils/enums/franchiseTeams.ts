/**
 * This file contains the enumerations for the player status codes
 * To compile this, type one of the following commands into the root of the project directory 
 * 
 * @option npm run compile
 * @option tsc ./utils/enums/playerStatusCodes.ts
 */

/**
 * @enum {ContenderTeams} Enumerations for the franchise emotes
 * @param {String} IE Ignium Esports
 * @param {String} VTX Infinite Vortex
 * @param {String} KC Kingdom Coffee
 * @param {String} LG Light Garden
 * @param {String} L7 Lucky Sevens
 * @param {String} OS Omnipotent Sandwiches
 * @param {String} TT DoubleTaps
 * @param {String} ATO The Automata
 * @param {String} PA Party Animals
 * @param {String} MF The Mafia
 * @param {String} SOL Solaris
 * @param {String} PPI Post Plant Incorporated
 */

export enum ContenderTeams {
    TIER = "Contender",
    IE = "Spark",
    VTX = "Cyclone",
    KC = "",
    LG = "Pink Azalea",
    L7 = "Snake Eyes",
    OS = "Celestial Calzones",
    TT = "",
    ATO = "Rock'em Sock'em",
    PA = "",
    MF = "",
    SOL = "Nebula",
    PPI = "Aftershock",
}

/**
 * @enum {AdvancedTeams} Enumerations for the franchise emotes
 * @param {String} IE Ignium Esports
 * @param {String} VTX Infinite Vortex
 * @param {String} KC Kingdom Coffee
 * @param {String} LG Light Garden
 * @param {String} L7 Lucky Sevens
 * @param {String} OS Omnipotent Sandwiches
 * @param {String} TT DoubleTaps
 * @param {String} ATO The Automata
 * @param {String} PA Party Animals
 * @param {String} MF The Mafia
 * @param {String} SOL Solaris
 * @param {String} PPI Post Plant Incorporated
 */

export enum AdvancedTeams {
    TIER = "Advanced",
    IE = "Blaze",
    VTX = "Hurricane",
    KC = "Cold Brew",
    LG = "Red Rose",
    L7 = "Yahtzee",
    OS = "Prophetic Paninis",
    TT = "Quickfire",
    ATO = "Swarm",
    PA = "Fragging Frogs",
    MF = "The Cleaners",
    SOL = "Zenith",
    PPI = "Snakebite",
}


/**
 * @enum {MasterTeams} Enumerations for the franchise emotes
 * @param {String} IE Ignium Esports
 * @param {String} VTX Infinite Vortex
 * @param {String} KC Kingdom Coffee
 * @param {String} LG Light Garden
 * @param {String} L7 Lucky Sevens
 * @param {String} OS Omnipotent Sandwiches
 * @param {String} TT DoubleTaps
 * @param {String} ATO The Automata
 * @param {String} PA Party Animals
 * @param {String} MF The Mafia
 * @param {String} SOL Solaris
 * @param {String} PPI Post Plant Incorporated
 */

export enum MasterTeams {
    TIER = "Master",
    IE = "Phoenix",
    VTX = "Tempest",
    KC = "Espresso",
    LG = "Purple Iris",
    L7 = "Blackjacks",
    OS = "Tutelary Tacos",
    TT = "Rapid",
    ATO = "Exos",
    PA = "Cracked Capybaras",
    MF = "The Mafiosos",
    SOL = "Eclipse",
    PPI = "Hunter’s Fury",
}


/**
 * @enum {EliteTeams} Enumerations for the franchise emotes
 * @param {String} IE Ignium Esports
 * @param {String} VTX Infinite Vortex
 * @param {String} KC Kingdom Coffee
 * @param {String} LG Light Garden
 * @param {String} L7 Lucky Sevens
 * @param {String} OS Omnipotent Sandwiches
 * @param {String} TT DoubleTaps
 * @param {String} ATO The Automata
 * @param {String} PA Party Animals
 * @param {String} MF The Mafia
 * @param {String} SOL Solaris
 * @param {String} PPI Post Plant Incorporated
 */

export enum EliteTeams {
    TIER = "Elite",
    IE = "Orion",
    VTX = "Maelstrom",
    KC = "Latte",
    LG = "Blue Lotus",
    L7 = "Royal Flush",
    OS = "Heroic Gyros",
    TT = "Twice",
    ATO = "Bionics",
    PA = "Bearzerkers",
    MF = "The Dons",
    SOL = "Event Horizon",
    PPI = "",
}
