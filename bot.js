require(`dotenv`).config();

// MODULE REQUIREMENTS ----------------------------------------------------------------------------
const fs = require(`fs`);
const Logger = require(`./src/core/logger.js`);
const BotClient = require(`./src/core/botClient.js`);
// ################################################################################################


// INITIALIZE LOGGER & CLEAR CONSOLE --------------------------------------------------------------
global.logger = new Logger();

console.clear();
logger.log(`VERBOSE`, `Starting...`);
// ################################################################################################


// INITALIZE CLIENT -------------------------------------------------------------------------------
global.client = new BotClient();
logger.log(`DEBUG`, `Initialized client!`);
// ################################################################################################


// CREATE WATCHERS/LISTENERS ----------------------------------------------------------------------
// catch exceptions and log to console
process.on(`uncaughtException`, (err) => {
    return logger.log(`ERROR`, err.cause, err.stack);
});

// catch warnings and log them to the console
process.on(`warning`, (warning) => {
    return logger.log(`WARNING`, warning.name, warning.stack);
});

// create hotreloading for cache
const mmrCachePath = `./cache/mmrCache.json`;

global.mmrCache = require(mmrCachePath);
fs.watchFile(mmrCachePath, () => {
    delete require.cache[require.resolve(mmrCachePath)];
    global.mmrCache = require(mmrCachePath);

    return logger.log(`INFO`, `Reloaded file: ${mmrCachePath}`);
});
// ################################################################################################


// LOAD COMMANDS, INTERACTIONS & EVENTS -----------------------------------------------------------
logger.log(`VERBOSE`, `Loading slash commands...`);
client.loadSlashCommands(`src/interactions/commands`);

logger.log(`VERBOSE`, `Loading buttons...`);
client.loadButtons(`src/interactions/buttons`);

logger.log(`VERBOSE`, `Loading select menus commands...`);
client.loadSelectMenus(`src/interactions/selectMenus`);

logger.log(`VERBOSE`, `Loading autocomplete queries...`);
client.loadAutocomplete(`src/interactions/autocomplete`);

logger.log(`VERBOSE`, `Loading events...`);
client.loadEvents(`src/events`);
// ################################################################################################


// LOGIN ------------------------------------------------------------------------------------------
client.login(process.env.TOKEN);
logger.log(`VERBOSE`, `Logging in with token...`);
// ################################################################################################


// FUNCTIONS --------------------------------------------------------------------------------------

// ################################################################################################