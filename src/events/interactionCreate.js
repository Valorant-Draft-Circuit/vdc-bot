const { Client, BaseInteraction, ChatInputCommandInteraction, ButtonInteraction, UserSelectMenuInteraction, AutocompleteInteraction, MessageFlags } = require(`discord.js`);
const { withSpan, SpanKind } = require(`../core/telemetry`);

module.exports = {

    /**
     * Emitted when an interaction is created.
     * @type {Event}
     * @references
     * @djs https://discord.js.org/#/docs/discord.js/main/class/Client?scrollTo=e-interactionCreate
     * @api https://discord.com/developers/docs/topics/gateway-events#interaction-create
     * @api https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object-interaction-structure
     */

    /**
     * @todo Create an "executeModal" handler function
     */

    name: `interactionCreate`,
    once: false,

    async execute(client, /** @type BaseInteraction */ interaction) {

        // Ignore DMs, except the web veto pager's Acknowledge buttons which live on DMs
        if (interaction.channel.isDMBased()) {
            const isWebVetoButton = interaction.isButton() && interaction.customId.startsWith(`webveto_`);
            if (!isWebVetoButton) {
                logger.log(`WARNING`, `User ${interaction.user} (\`${interaction.user.username}\`, \`${interaction.user.id}\`) tried to use a command in DMs`);
                return await interaction.reply({ content: `You cannot use this command in direct messages` });
            }
        }

        const { name, attributes } = describeInteraction(interaction);
        const run = async () => {
            try {
                if (interaction.isCommand()) return await executeCommand(client, interaction);
                if (interaction.isButton()) return await executeButton(client, interaction);
                if (interaction.isAnySelectMenu()) return await executeSelectMenu(client, interaction);
                if (interaction.isModalSubmit()) return await executeModal(client, interaction);
                if (interaction.isAutocomplete()) return await executeAutocomplete(client, interaction);
            } catch (err) {
                logger.log(`ERROR`, `\`${interaction.user.tag}\` hit an error in \`${name}\`: ${err.name}: ${err.message}`, err);
            }
        };

        // autocompletes fire on every keystroke, so they don't get a trace of their own
        if (interaction.isAutocomplete()) return await run();
        return await withSpan(name, attributes, run, { kind: SpanKind.SERVER });
    }
};

/**
 * Span name and attributes for an interaction. The name identifies what ran (`/queue join`,
 * `button queueManager_submit`) and the attributes hold who, where and with which options.
 * @param {BaseInteraction} interaction
 */
function describeInteraction(interaction) {
    const attributes = {
        'discord.interaction.id': interaction.id,
        'discord.user.id': interaction.user.id,
        'discord.user.name': interaction.user.username,
        'discord.guild.id': interaction.guildId ?? ``,
        'discord.channel.id': interaction.channelId ?? ``,
    };

    if (interaction.isCommand() || interaction.isAutocomplete()) {
        const command = commandPath(interaction);
        attributes[`discord.interaction.type`] = `command`;
        attributes[`discord.command`] = command;
        for (const [option, value] of flattenOptions(interaction.options.data)) attributes[`discord.option.${option}`] = value;
        return { name: command, attributes };
    }

    // custom IDs look like `prefix_action-id-id`; everything after the first `-` is per-message
    const customId = interaction.customId ?? ``;
    const baseId = customId.split(`-`)[0];
    attributes[`discord.custom_id`] = customId;

    if (interaction.isButton()) {
        attributes[`discord.interaction.type`] = `button`;
        return { name: `button ${baseId}`, attributes };
    }
    if (interaction.isAnySelectMenu()) {
        attributes[`discord.interaction.type`] = `select`;
        attributes[`discord.select.values`] = interaction.values.join(`,`);
        return { name: `select ${baseId}`, attributes };
    }
    if (interaction.isModalSubmit()) {
        attributes[`discord.interaction.type`] = `modal`;
        return { name: `modal ${baseId}`, attributes };
    }
    return { name: `interaction ${interaction.type}`, attributes };
}

/** `/queue join`, `/queueadmin player reset`; context menu commands keep their plain name */
function commandPath(interaction) {
    if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return interaction.commandName;
    const group = interaction.options.getSubcommandGroup(false);
    const subcommand = interaction.options.getSubcommand(false);
    return [`/${interaction.commandName}`, group, subcommand].filter(Boolean).join(` `);
}

/** [name, value] for every option the user filled in, unwrapping subcommands and groups */
function* flattenOptions(options = []) {
    for (const option of options) {
        if (option.options) yield* flattenOptions(option.options);
        else if (option.value !== undefined) yield [option.name, String(option.value)];
    }
}

/** The command as the user typed it, e.g. `/queue join tier:RECRUIT` */
function commandLine(interaction) {
    const options = [...flattenOptions(interaction.options.data)].map(([option, value]) => `${option}:${value}`);
    return [commandPath(interaction), ...options].join(` `);
}

/**
 * Function to execute slash commands
 * @param {Client} client The active BotClient instance
 * @param {ChatInputCommandInteraction} interaction The interaction object passed to the interactionCreate event
 */
async function executeCommand(client, interaction) {
    const command = client.slashCommands.get(interaction.commandName);

    if (command) {
        logger.log(`INFO`, `\`${interaction.user.tag}\` ran \`${commandLine(interaction)}\``);
        await command.execute(interaction);

    } else throw new ReferenceError(`Cannot find the application command file!`, { cause: `File is either missing or does not exist.` });
}

/**
 * Handle modal submits dynamically via client.modals
 * @param {Client} client
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function executeModal(client, interaction) {
    const customId = interaction.customId ?? ``;
    const modalId = customId.split(`-`)[0];
    const modalHandler = client.modals.get(modalId);
    if (!modalHandler) {
        logger.log(`WARNING`, `No modal handler found for ${modalId}`);
        return interaction.reply({ content: `This modal is not supported.`, flags: MessageFlags.Ephemeral });
    }

    const args = customId.split(`-`).slice(1);
    return await modalHandler.execute(interaction, ...args);
}

/**
 * Function to execute button commands
 * @param {Client} client The active BotClient instance
 * @param {ButtonInteraction} interaction The interaction object passed to the interactionCreate event
 */
async function executeButton(client, interaction) {
    const buttonIDComponent = interaction.customId.split(`_`);
    let buttonID, button, args;

    switch (buttonIDComponent.length) {
        case 1: // button is not part of a managed set
            buttonID = buttonIDComponent[0];
            button = client.buttons.get(buttonID);
            args = [interaction];
            break;

        case 2: // button is part of a managed set (second arg is function)
            buttonID = `${buttonIDComponent[0]}Manager`;
            button = client.buttons.get(buttonID);
            args = [interaction, buttonIDComponent[1]];
            break;
    }

    if (button) {
        logger.log(`INFO`, `\`${interaction.user.tag}\` clicked on the \`${interaction.customId}\` button`);
        await button.execute(...args);

    } else throw new ReferenceError(`Cannot find the interaction button file!`, { cause: `File is either missing or does not exist.` });
}

/**
 * Function to parse select menu arguments
 * @param {Client} client The active BotClient instance
 * @param {UserSelectMenuInteraction} interaction The interaction object passed to the interactionCreate event
 */
async function executeSelectMenu(client, interaction) {
    const selectMenuIDComponent = interaction.customId.split(`_`);
    let selectMenuID, selectMenu, args;

    if (selectMenuIDComponent.length == 1) {
        selectMenuID = selectMenuIDComponent[0];
        selectMenu = client.selectMenus.get(selectMenuID);
        args = [interaction];
    } else {
        selectMenuID = `${selectMenuIDComponent[0]}Manager`;
        selectMenu = client.selectMenus.get(selectMenuID);
        args = [interaction, selectMenuIDComponent[1]];
    }

    if (selectMenu) {
        logger.log(`INFO`, `\`${interaction.user.tag}\` interacted with the \`${interaction.customId}\` select menu!`);
        await selectMenu.execute(...args);
    } else throw new ReferenceError(`Cannot find the select menu file!`, { cause: `File is either missing or does not exist.` });
}

/**
 * Function to parse select menu arguments
 * @param {Client} client The active BotClient instance
 * @param {AutocompleteInteraction} interaction The interaction object passed to the interactionCreate event
 */
async function executeAutocomplete(client, interaction) {
    const focusedFieldName = interaction.options.getFocused(true).name;
    const autocompleteCommandQuery = client.autocompletes.get(focusedFieldName) ||
        client.autocompletes.get(focusedFieldName.split(`-`)[focusedFieldName.split(`-`).length - 1]);

    if (autocompleteCommandQuery) {
        // logger.log(`INFO`, `\`${interaction.user.tag}\` executed an autocomplete query`);
        return await autocompleteCommandQuery.execute(interaction);

    } else throw new ReferenceError(`Cannot find the autocomplete file!`, { cause: `File is either missing or does not exist.` });
}