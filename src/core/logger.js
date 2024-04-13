const chalk = require(`chalk`);

module.exports = class Logger {
    constructor() {
        /** @member {Class} client the active BotClient */
        this.client;

        /** @member {Object} config load config data */
        this.config = require(`./config.js`);

        /** @member {Object} guild fetch guild object for Online College */
        this.guild;

        /** @member {Object} consoleChannel fetch channel object for consoleChannel */
        this.consoleChannel;

        /** @member {Object} dmChannel fetch channel object for dmChannel */
        this.dmChannel;
    }

    /**
     * Initializer function for the Logger Class - set this.guild & this.consoleChannel
     * @param {String} guildID ID of the guild
     * @param {Object} channels IDs of the channel stored in config.js
     */
    async init(/* guildID = this.config.SERVER_ID.DEVELOPMENT, channels = this.config.CHANNELS*/) {
        // this.guild = await this.client.guilds.fetch(guildID);
        // this.consoleChannel = await this.guild.channels.fetch(channels.TEST_CONSOLE);
        // this.dmChannel = await this.guild.channels.fetch(channels.TEST_DIRMSGS);

        this.console({
            level: `DEBUG`,
            title: `Initalized Guild & Channel Objects`,
            message: [
                `- Fetched guild`,
                `- Fetched console & DM channels`
            ],
        });

        return;
    };

    /**
     * Log all relevant console events
     * @param {Object} consoleObject The object to be parsed and outputted to the console
     * @param {String} consoleObject.level INFO/DEBUG/WARNING/ERROR
     * @param {String} consoleObject.title title of message to log to console
     * @param {String|String[]} consoleObject.message details as string (single line) or array (for multi-line output)
     * @param {Stack} consoleObject.stack stack
     * @returns Text to Console
     */
    console(consoleObject) {
        /**
        client.logger.console({
            level: ``,
            title: ``,
            message: [``],
            stack: stack,
        });
         */
        const { level, title, message, stack, timestamp = Date.now() } = consoleObject;
        const { green, blue, yellow, red } = chalk;
        const out = { message: [] };

        // set constant padding length
        const messagePadding = ``.padStart(7);
        out.level = level.padStart(7);

        // get human-readable date & time in CST
        const time = new Date(timestamp).toLocaleString("en-US", { timeZone: `CST`, month: `short`, day: `2-digit`, hour: `numeric`, minute: `numeric` });

        /** @todo console log err */
        if (![`INFO`, `DEBUG`, `WARNING`, `ERROR`].includes(level)) return

        switch (level) {
            case `INFO`:
                out.title = `${green(time)} | ${green(out.level)} : ` + (message ? green(title) : title);
                break;

            case `DEBUG`:
                out.title = `${blue(time)} | ${blue(out.level)} : ${blue(title)}`;
                break;

            case `WARNING`:
                out.title = `${yellow(time)} | ${yellow(out.level)} : ${yellow(title)}`;
                break;

            case `ERROR`:
                out.title = `${red(time)} | ${red(out.level)} : ${red(title)}`;
                break;
        }

        // if the message is an array of messages or a single line
        if (Array.isArray(message)) {
            message.forEach(msg => {
                out.message.push(messagePadding + msg);
            });
            // out.message = outMsgArr.join(`\n`);
        } else if (message) {
            out.message.push(messagePadding + message);
        }

        // console.log(out.message)
        if (stack) {
            out.message.push(red(`----------------------------------- STACK -----------------------------------`));
            const stackArr = stack.replaceAll(__dirname.replace(`core`, ``), `./`).split("\n", 50);
            stackArr.forEach(line => {
                out.message.push(line);
            })
        }

        console.log(out.title);
        if (out.message.length > 0) console.log(out.message.join(`\n`));
    };
}

/**
 * Export the Logger module for use in the rest of the project
 */