const fs = require(`fs`);

const { Client, Collection, EmbedBuilder } = require("discord.js");

const {
    Guilds, GuildMessages,
    GuildVoiceStates, GuildMembers,
    GuildPresences, DirectMessages
} = require("discord.js").GatewayIntentBits;
const { Channel } = require("discord.js").Partials;

/** @NOTE - THIS IS TEMPORARY. WILL BE CHANGED ASAP */
const cmdWhitelist = [`ping`, `submit`, `topic`, `welcome`, `transactions`, `setup`, `active`, `roster`];


module.exports = class BotClient extends Client {
    constructor(environment) {
        super({
            intents: [
                Guilds, GuildMessages,
                GuildVoiceStates, GuildMembers,
                GuildPresences, DirectMessages
            ],
            partials: [Channel],
        });

        this.config = require(`./config.js`); // load the config file
        // this.emotes = require(`../utils/resources/emotes.js`); // load the emote refrences
        this.environment = environment; // environment bot is in (dev || live)

        /** @type {Collection} - slash commands collection */
        this.slashCommands = new Collection();

        /** @type {Collection} - select menus collection */
        this.selectMenus = new Collection();

        /** @type {Collection} - button manager collection */
        this.buttons = new Collection();

        /** @type {Collection} - button manager collection */
        this.autocompletes = new Collection();

        /** @member {Class} logger instanciated by ready.js  */
        this.logger;
    };

    /**
     * Load event handlers from specified directory
     * @param {String} directory
     */
    loadEvents(directory) {

        // get event files & filter by .js files
        const eventFiles = fs.readdirSync(directory);
        let success = 0;
        let failure = 0;

        // turn on event handlers
        eventFiles.forEach(eventFile => {
            const event = require(`.${directory}/${eventFile}`);

            try {
                if (event.once) {
                    this.once(event.name, (...args) => {
                        event.execute(this, ...args);
                    })
                } else {
                    this.on(event.name, (...args) => {
                        event.execute(this, ...args);
                    })
                }
                success++;
            } catch (error) {
                failure++;
            }

        });

        this.logger.console({
            level: `DEBUG`,
            title: `Initalized Event Handlers`,
            message: [
                `From (${directory}/)...`,
                `- ${success} events successfully loaded`,
                `- ${failure} events failed to load`
            ],
        });
    };

    /**
     * Registers all slash commands with the server
     * @param {Client} readyClient the initialized client (called from `ready` event)
     * @param {String} directory path to application commands structure files
     */
    registerSlashCommands(readyClient, directory) {
        // register slash commands (rewrite deploy.js)
        const slashCommandFiles = fs.readdirSync(directory).filter(f => f.endsWith(`.js`));
        const commandStructures = [];
        let success = 0;

        slashCommandFiles.forEach(slashCommandFile => {
            const command = require(`.${directory}/${slashCommandFile}`);

            if (!cmdWhitelist.includes(command.name)) return;

            commandStructures.push(command);
            success++;
        });

        // console.log(commandStructures.options)


        /** @todo create filters to register VDC servers, franchise servers and other */
        // const serverID = `1027754353207033966`;
        // readyClient.guilds.cache.get(serverID).commands.set(commandStructures);

        // globally register all application commands
        // readyClient.application.commands.set([]);
        readyClient.application.commands.set(commandStructures);

        this.logger.console({
            level: `DEBUG`,
            title: `Registered Slash Commands`,
            message: [
                `From (${directory}/)...`,
                `- ${success} command(s) registered`
            ],
        });
    };

    /**
     * Load slash command files from specified directory
     * @param {String} directory
     */
    loadSlashCommands(directory) {
        /* TODO: Load Slash Commands
            - Log function start
            - Track successful & unsuccessful slash command loads
            - Offload file validation to getFilePath(dir, ext)?
        */
        // register all slash commands
        const slashCommandFiles = fs.readdirSync(directory).filter(f => f.endsWith(`.js`));
        let success = 0;

        slashCommandFiles.forEach(slashCommandFile => {
            const slashCommand = require(`.${directory}/${slashCommandFile}`);
            if (!cmdWhitelist.includes(slashCommand.name)) return;
            this.slashCommands.set(slashCommand.name, slashCommand);
            success++;
        });

        this.logger.console({
            level: `DEBUG`,
            title: `Loaded Slash Commands`,
            message: [
                `From (${directory}/)...`,
                `- ${success} command(s) loaded`
            ],
        });
    };

    /**
     * Load button & button manager files from specified directory
     * @param {String} directory
     */
    loadButtons(directory) {
        /* TODO: Load Button Managers
            - Log function start
            - Track successful & unsuccessful button manager loads
            - Offload file validation to getFilePath(dir, ext)?
        */
        const buttonFiles = fs.readdirSync(directory);
        let success = 0;

        buttonFiles.forEach(buttonFile => {
            const button = require(`.${directory}/${buttonFile}`);
            this.buttons.set(button.id, button);
            success++;
        });

        this.logger.console({
            level: `DEBUG`,
            title: `Loaded Buttons & Button Managers`,
            message: [
                `From (${directory}/)...`,
                `- ${success} button/(manager)(s) loaded`
            ],
        });
    };

    /**
     * Load select menus from specified directory
     * @param {String} directory
     */
    loadSelectMenus(directory) {
        /* TODO: Load Select Menus
            - Log function start
            - Track successful & unsuccessful select menu loads
            - Offload file validation to getFilePath(dir, ext)?
        */
        const selectMenuFiles = fs.readdirSync(directory);
        let success = 0;

        selectMenuFiles.forEach(selectMenuFile => {
            const selectMenu = require(`.${directory}/${selectMenuFile}`);
            this.selectMenus.set(selectMenu.id, selectMenu);
            success++;
        });

        this.logger.console({
            level: `DEBUG`,
            title: `Loaded Select Menus`,
            message: [
                `From (${directory}/)...`,
                `- ${success} menu(s) loaded`
            ],
        });
    };

    /**
     * Load autocomplete from specified directory
     * @param {String} directory
     */
    loadAutocomplete(directory) {
        /* TODO: autocomplete
            - Log function start
            - Track successful & unsuccessful select menu loads
            - Offload file validation to getFilePath(dir, ext)?
        */
        const autocompleteFiles = fs.readdirSync(directory).filter(f => f.endsWith(`.js`));
        let success = 0;

        autocompleteFiles.forEach(autocompleteFile => {
            const autocomplete = require(`.${directory}/${autocompleteFile}`);
            this.autocompletes.set(autocomplete.name, autocomplete);
            success++;
        });

        this.logger.console({
            level: `DEBUG`,
            title: `Loaded Autocomplete Queries`,
            message: [
                `From (${directory}/)...`,
                `- ${success} querie(s) loaded`
            ],
        });
    };
};
