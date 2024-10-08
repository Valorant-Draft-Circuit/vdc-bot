require(`dotenv`).config();

const BotClient = require(`./src/core/botClient.js`);
const Logger = require(`./src/core/logger.js`)

console.clear();

// initialize client
const client = new BotClient();

// initialize logger & attach to new BotClient
const logger = new Logger();
client.logger = logger;

// catch exceptions and log to console
process.on(`uncaughtException`, (err) => {
    client.logger.console({
        level: `ERROR`,
        title: err.name,
        message: err.cause,
        stack: err.stack,
    });
});

// catch warnings and log them to the console
process.on(`warning`, (warning) => {
    client.logger.console({
        level: `WARNING`,
        title: warning.name,
        stack: warning.stack,
    });
});

// start the bot
client.logger.console({
    level: `DEBUG`,
    title: `Starting...`,
    message: `Initalized BotClient & attached Logger to the BotClient instance`,
});

client.loadSlashCommands(`src/interactions/commands`);
client.loadButtons(`src/interactions/buttons`);
client.loadSelectMenus(`src/interactions/selectMenus`);
client.loadAutocomplete(`src/interactions/autocomplete`);
client.loadEvents(`src/events`);

client.login(process.env.TOKEN);
client.logger.console({
    level: `DEBUG`,
    title: `Logging in with bot token...`,
});
