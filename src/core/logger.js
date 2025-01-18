const chalk = require(`chalk`);

// console color
const ccolor = {
    INFO: chalk.green,
    VERBOSE: chalk.magenta,
    DEBUG: chalk.blue,
    WARNING: chalk.yellow,
    ERROR: chalk.red
};

const ldemote = {
    INFO: `🟩`,
    VERBOSE: `🟪`,
    DEBUG: `🟦`,
    WARNING: `🟨`,
    ERROR: `🟥`
}

const channels = {
    matchDrainID: `1224147409899225140`
}

module.exports = class Logger {
    constructor() {
        /** @member {Object} logdrain channel object for bot logs */
        this.logdrain;
        this.matchDrain;

        this.logdrainReady = false;
        this.outqueue = [];
    }

    /** Initializer function for the Logger Class */
    async init() {

        this.log(`VERBOSE`, `Fetching logdrain channels...`);

        if (!(/true/i).test(process.env.LOGDRAIN_ENABLE)) return await this.log(`INFO`, `Environment variable LOGDRAIN_ENABLE is set to false, set incorrectly or doesn't exist, skipping logdrain initialization`);

        // check if environment variables exist
        if (process.env.DEV_SERVER === undefined) return await this.log(`WARNING`, `No environment variable set for development server, skipping logdrain initialization`);
        if (process.env.LOGGING_CHANNEL === undefined) return await this.log(`WARNING`, `No environment variable set for logdrain channel, skipping logdrain initialization`);

        // fetch the relevant server & channel for logging
        const loggingServer = await client.guilds.cache.get(process.env.DEV_SERVER);
        if (loggingServer === undefined) return await this.log(`WARNING`, `Failed to fetch server for logdrain, skipping drain initialization`);

        // fetch match drain channel
        const matchdrainchannel = await loggingServer.channels.cache.get(channels.matchDrainID);
        if (matchdrainchannel === undefined) await this.log(`WARNING`, `Failed to fetch channel for matchdrain, skipping matchdrain initialization`);
        if (matchdrainchannel) this.matchDrain = matchdrainchannel;

        const logdrainchannel = await loggingServer.channels.cache.get(process.env.LOGGING_CHANNEL);
        if (logdrainchannel === undefined) return await this.log(`WARNING`, `Failed to fetch channel for logdrain, skipping logdrain initialization`);

        // save as channel
        this.logdrainReady = true;
        this.logdrain = logdrainchannel;

        return this.log(`DEBUG`, `Fetched logdrain channel - (name: ${logdrainchannel.name}, id: ${logdrainchannel.id})`);
    };

    matchdrain(message) {
        this.matchDrain.send(message);
    }

    /**
     * Push console events to stdout & forward to channel
     * @param {Object} obj The object to be parsed and outputted to the console
     * @param {`INFO`|`VERBOSE`|`DEBUG`|`WARNING`|`ERROR`} level log level
     * @param {String} title title of message to log to console
     * @param {String} message details as string (single line) or array (for multi-line output)
     * @param {Stack} stack stack
     */
    log(level, message, stack, timestamp = Date.now()) {

        // date & time
        const time = new Date(timestamp).toLocaleString("en-US", { timeZone: `CST`, month: `short`, day: `2-digit`, hour: `numeric`, minute: `numeric` });
        const timestampDate = Math.round(Date.now()/1000);

        const levelOut = level.padStart(8, ` `);

        let tidyStack;
        if (stack) tidyStack = stack.replaceAll(__dirname.replace(`src\\core`, ``), `./`).replaceAll(`\\`, `/`);

        // out to console
        console.log(`${ccolor[level](time)} | ${ccolor[level](levelOut)} : ${message}`);
        if (stack) console.log(tidyStack);

        // discord logdrain
        let logmsg = `${ldemote[level]} <t:${timestampDate}:d> <t:${timestampDate}:T> \` ${levelOut} \` : ${message}`;
        
        if (stack) logmsg += `\n\`\`\`js\n${tidyStack}\n\`\`\``;
        this.outqueue.push(logmsg);
        return this.processLogQueue();
    };

    async processLogQueue() {

        if (!this.logdrainReady) return;

        const message = this.outqueue.shift();
        await this.logdrain.send(message);

        if (this.outqueue.length !== 0) return await this.processLogQueue();
    };
}
