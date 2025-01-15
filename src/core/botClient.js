const fs = require(`fs`);

const { Client, Collection, ActivityType } = require("discord.js");
const path = require("path");

const {
    Guilds, GuildMessages,
    GuildVoiceStates, GuildMembers,
    GuildPresences, DirectMessages, MessageContent
} = require("discord.js").GatewayIntentBits;
const { Channel } = require("discord.js").Partials;


module.exports = class BotClient extends Client {
    constructor(environment) {
        super({
            presence: {
                activities: [
                    { type: ActivityType.Watching, name: `travestey write bad code` }
                ]
            },
            intents: [
                Guilds, GuildMessages,
                GuildVoiceStates, GuildMembers,
                GuildPresences, DirectMessages, MessageContent
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
            const eventFilePath = path.resolve(__dirname, `../../${directory}/${eventFile}`);
            const event = require(eventFilePath);

            try {
                if (event.once) this.once(event.name, (...args) => event.execute(this, ...args)); else this.on(event.name, (...args) => event.execute(this, ...args));
                success++;
            } catch (error) {
                failure++;
            }

        });

        logger.log(`DEBUG`, `Loaded ${success} events(s) from (${directory}/)!`);
        if (failure !== 0) logger.log(`WARNING`, `Failed to load ${failure} events(s) from (${directory}/)!`);
        return
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
            const slashCommandPath = path.resolve(__dirname, `../../${directory}/${slashCommandFile}`);
            const command = require(slashCommandPath);
            commandStructures.push(command);
            success++;
        });

        /** @todo create filters to register VDC servers, franchise servers and other */
        if (process.env.ENVIRONMENT === `DEV`) {
            const serverID = `1027754353207033966`;
            readyClient.guilds.cache.get(serverID).commands.set(commandStructures);

            readyClient.application.commands.set([]);
            logger.log(`INFO`, `Running in the development environment`);
        } else {
            // globally register all application commands
            readyClient.application.commands.set(commandStructures);
            logger.log(`INFO`, `Running in the production environment`);

        }


        logger.log(`DEBUG`, `Registered ${success} command(s) from (${directory}/)!`);
    };

    /**
     * Load slash command files from specified directory
     * @param {String} directory
     */
    loadSlashCommands(directory) {
        // register all slash commands
        const slashCommandFiles = fs.readdirSync(directory).filter(f => f.endsWith(`.js`));
        let success = 0;

        slashCommandFiles.forEach(slashCommandFile => {
            const commandPath = path.resolve(__dirname, `../../${directory}/${slashCommandFile}`);
            const slashCommand = require(commandPath);
            this.slashCommands.set(slashCommand.name, slashCommand);
            success++;
        });

        return logger.log(`DEBUG`, `Loaded ${success} command(s) from (${directory}/)!`);
    };

    /**
     * Load button & button manager files from specified directory
     * @param {String} directory
     */
    loadButtons(directory) {
        const buttonFiles = fs.readdirSync(directory);
        let success = 0;

        buttonFiles.forEach(buttonFile => {
            const buttonPath = path.resolve(__dirname, `../../${directory}/${buttonFile}`);
            const button = require(buttonPath);
            this.buttons.set(button.id, button);
            success++;
        });

        return logger.log(`DEBUG`, `Loaded ${success} button(s) from (${directory}/)!`);
    };

    /**
     * Load select menus from specified directory
     * @param {String} directory
     */
    loadSelectMenus(directory) {
        const selectMenuFiles = fs.readdirSync(directory);
        let success = 0;

        selectMenuFiles.forEach(selectMenuFile => {
            const selectMenuPath = path.resolve(__dirname, `../../${directory}/${selectMenuFile}`);
            const selectMenu = require(selectMenuPath);
            this.selectMenus.set(selectMenu.id, selectMenu);
            success++;
        });

        
        logger.log(`DEBUG`, `Loaded ${success} select menu(s) from (${directory}/)!`);
    };

    /**
     * Load autocomplete from specified directory
     * @param {String} directory
     */
    loadAutocomplete(directory) {
        const autocompleteFiles = fs.readdirSync(directory).filter(f => f.endsWith(`.js`));
        let success = 0;

        autocompleteFiles.forEach(autocompleteFile => {
            const autocompleteFilePath = path.resolve(__dirname, `../../${directory}/${autocompleteFile}`);
            const autocomplete = require(autocompleteFilePath);

            // add autocompletes to the collection, including any/all aliases
            this.autocompletes.set(autocomplete.name, autocomplete);
            if (autocomplete.alias) {
                autocomplete.alias.forEach(alias => this.autocompletes.set(alias, autocomplete));
            }
            
            success++;
        });

        
        logger.log(`DEBUG`, `Loaded ${success} autocomplete queries from (${directory}/)!`);
    };
};
