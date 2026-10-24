const { time, TimestampStyles, roleMention } = require(`discord.js`);
const chalk = require(`chalk`);
const { emitLog, grafanaLink } = require(`./telemetry.js`);

const DISCORD_MESSAGE_LIMIT = 2000;

// Grafana gets every line; the Discord logdrain only gets LOGDRAIN_LEVEL and above (unset = none). ALERT ranks
// highest because it pings the alerts role for something staff have to fix by hand.
const DRAIN_LEVELS = [`VERBOSE`, `DEBUG`, `INFO`, `WARNING`, `ERROR`, `ALERT`];
const drainFrom = DRAIN_LEVELS.indexOf(String(process.env.LOGDRAIN_LEVEL ?? ``).trim().toUpperCase());

// console color
const ccolor = {
    INFO: chalk.green,
    VERBOSE: chalk.magenta,
    DEBUG: chalk.blue,
    WARNING: chalk.yellow,
    ALERT: chalk.keyword(`orange`),
    ERROR: chalk.red
};

const ldemote = {
    INFO: `🟩`,
    VERBOSE: `🟪`,
    DEBUG: `🟦`,
    WARNING: `🟨`,
    ALERT: `🟧`,
    ERROR: `🟥`
}

const TECH_LEAD_ROLE = `1172963557504209027`;
const VDC_ALERTS_ROLE = `1355227407778451476`;

const ALERT_ROLE_ID = !Boolean(Number(process.env.PROD)) ? TECH_LEAD_ROLE : VDC_ALERTS_ROLE; // role ID for alert pings

const channels = {
    matchDrainID: `1224147409899225140`,    // #submitted-games
    memberlogs: !Boolean(Number(process.env.PROD)) ?
        `1328952835932684400`   :           // #logdrain-test
        `966986710204428291`    ,           // #logdrain-bot
}

module.exports = class Logger {
    constructor() {
        /** @member {Object} logdrain channel object for bot logs */
        this.logdrain;
        this.matchDrain;
        this.memberlogDrain;

        this.logdrainReady = false;
        this.drainsChecked = false;
        this.outqueue = [];
    }

    /** Initializer function for the Logger Class */
    async init() {
        await this.connectDrains();
        this.drainsChecked = true;

        // lines queued before the drain came up; if it never will, nothing would ever send them
        if (!this.logdrainReady) this.outqueue = [];

        if (drainFrom === -1) this.log(`INFO`, `Discord logdrain posts no log lines (LOGDRAIN_LEVEL unset); every line is in Grafana`);
        else this.log(`INFO`, `Discord logdrain posts ${DRAIN_LEVELS.slice(drainFrom).join(`, `)} lines (LOGDRAIN_LEVEL=${DRAIN_LEVELS[drainFrom]})`);
    }

    /** Fetch the Discord drain channels: logdrain (log lines), matchdrain and memberlogs */
    async connectDrains() {

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
        if (matchdrainchannel) await this.log(`DEBUG`, `Fetched matchdrain channel - (name: ${matchdrainchannel.name}, id: ${matchdrainchannel.id})`);

        // fetch member log drain channel
        const mainServer = await client.guilds.cache.get(process.env.SERVER_ID);
        const memberlogdrainchannel = await mainServer.channels.cache.get(channels.memberlogs);
        if (memberlogdrainchannel === undefined) await this.log(`WARNING`, `Failed to fetch channel for memberlogs, skipping memberlogs initialization`);
        if (memberlogdrainchannel) this.memberlogDrain = memberlogdrainchannel;
        if (memberlogdrainchannel) await this.log(`DEBUG`, `Fetched memberlog channel - (name: ${memberlogdrainchannel.name}, id: ${memberlogdrainchannel.id})`);

        const logdrainchannel = await loggingServer.channels.cache.get(process.env.LOGGING_CHANNEL);
        if (logdrainchannel === undefined) return await this.log(`WARNING`, `Failed to fetch channel for logdrain, skipping logdrain initialization`);

        // save as channel
        this.logdrainReady = true;
        this.logdrain = logdrainchannel;

        return this.log(`DEBUG`, `Fetched logdrain channel - (name: ${logdrainchannel.name}, id: ${logdrainchannel.id})`);
    };

    matchdrain(message) {
        if (!this.matchDrain) return this.log(`WARNING`, `Attempted to send a message to the matchdrain channel, but it hasn't been initialized!`);
        this.matchDrain.send(message);
    }

    memberdrain(message) {
        if (!this.memberlogDrain) return this.log(`WARNING`, `Attempted to send a message to the memberlogdrain channel, but it hasn't been initialized!`);
        this.memberlogDrain.send(message);
    }

    /**
     * Push console events to stdout & forward to channel
     * @param {Object} obj The object to be parsed and outputted to the console
     * @param {`INFO`|`VERBOSE`|`DEBUG`|`WARNING`|`ALERT`|`ERROR`} level log level
     * @param {String} title title of message to log to console
     * @param {String} message details as string (single line) or array (for multi-line output)
     * @param {Stack} stack stack
     */
    log(level, message, stack, timestamp = Date.now()) {

        // date & time
        const localTime = new Date(timestamp).toLocaleString("en-US", { timeZone: `CST`, month: `short`, day: `2-digit`, hour: `numeric`, minute: `numeric` });
        const timestampDate = Math.round(Date.now() / 1000);

        const levelOut = level.padStart(8, ` `);

        let tidyStack;
        if (stack) {
            const stackText = typeof stack === `string`
                ? stack
                : stack?.stack
                    ? stack.stack
                    : String(stack);
            tidyStack = stackText.replaceAll(__dirname.replace(`src\\core`, ``), `./`).replaceAll(`\\`, `/`);
        }

        // out to console
        console.log(`${ccolor[level](localTime)} | ${ccolor[level](levelOut)} : ${message}`);
        if (stack) console.log(tidyStack);

        // out to Grafana (Loki), linked to the active trace
        emitLog(level, message, stack, timestamp);

        // discord logdrain: LOGDRAIN_LEVEL and above, one line each; stacks stay in Grafana, behind a link
        if (drainFrom === -1 || DRAIN_LEVELS.indexOf(level) < drainFrom) return;
        if (this.drainsChecked && !this.logdrainReady) return;

        const head = `${ldemote[level]} ${time(timestampDate, TimestampStyles.ShortDate)} ${time(timestampDate, TimestampStyles.MediumTime)} \` ${levelOut} \` : ${level == `ALERT` ? `${roleMention(ALERT_ROLE_ID)} ` : ``}`;
        const link = stack || DRAIN_LEVELS.indexOf(level) >= DRAIN_LEVELS.indexOf(`ERROR`) ? grafanaLink(timestamp) : null;
        const tail = link ? ` · [${link.label}](<${link.url}>)` : ``;

        // Discord rejects messages over 2000 characters; trim the message, never the link
        const room = DISCORD_MESSAGE_LIMIT - head.length - tail.length;
        const body = String(message).length > room ? `${String(message).slice(0, room - 3)}...` : String(message);

        this.outqueue.push(`${head}${body}${tail}`);
        return this.processLogQueue();
    };

    async processLogQueue() {

        if (!this.logdrainReady) return;

        const message = this.outqueue.shift();
        await this.logdrain.send(message);

        if (this.outqueue.length !== 0) return await this.processLogQueue();
    };
}
