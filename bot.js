require(`dotenv`).config();

const BotClient = require(`./core/botClient.js`);
const Logger = require(`./core/logger.js`)

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
    client.consoleQueue.push({
        level: `ERROR`,
        title: err.name,
        message: err.cause,
        stack: err.stack,
    })
});

// catch warnings and log them to the console
process.on(`warning`, (warning) => {
    client.logger.console({
        level: `WARNING`,
        title: warning.name,
        stack: warning.stack,
    });
    client.consoleQueue.push({
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
client.consoleQueue.push({
    level: `DEBUG`,
    title: `Starting...`,
    message: `Initalized BotClient & attached Logger to the BotClient instance`,
})

client.loadSlashCommands(`./interactions/commands`);
client.loadButtons(`./interactions/buttons`);
client.loadSelectMenus(`./interactions/selectMenus`);
client.loadAutocomplete(`./interactions/autocomplete`);
client.loadEvents(`./events`);

client.login(process.env.TOKEN);
client.logger.console({
    level: `DEBUG`,
    title: `Logging in with bot token...`,
});
client.consoleQueue.push({
    level: `DEBUG`,
    title: `Logging in with bot token...`,
})