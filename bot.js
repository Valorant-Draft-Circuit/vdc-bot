require(`dotenv`).config();

// initalize logger
const Logger = require(`./src/core/logger.js`);
global.logger = new Logger();


console.clear();
logger.log(`VERBOSE`, `Starting...`);

// initialize client
const BotClient = require(`./src/core/botClient.js`);
global.client = new BotClient();
logger.log(`DEBUG`, `Initalized client!`);


// catch exceptions and log to console
process.on(`uncaughtException`, (err) => {
    return logger.log(`ERROR`, err.cause, err.stack);
});

// catch warnings and log them to the console
process.on(`warning`, (warning) => {
    return logger.log(`WARNING`, warning.name, warning.stack);
});


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


client.login(process.env.TOKEN);
logger.log(`VERBOSE`, `Logging in with token...`);
