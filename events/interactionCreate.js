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

    async execute(client, interaction) {
        try {
            if (interaction.isCommand()) return await executeCommand(client, interaction);
            if (interaction.isButton()) return await executeButton(client, interaction);
            if (interaction.isSelectMenu()) return await executeSelectMenu(client, interaction);
        } catch (err) {
            client.logger.console({
                level: `ERROR`,
                title: `${err.name}: Event - ${this.name}`,
                message: err.cause,
                stack: err.stack,
            });
        }
    }
};

/**
 * Function to execute slash commands
 * @param {Client} client The active BotClient instance
 * @param {Object} interaction The interaction object passed to the interactionCreate event
 */
async function executeCommand(client, interaction) {
    const command = client.slashCommands.get(interaction.commandName);

    if (command) {
        client.logger.console({
            level: `INFO`,
            title: `Event - interactionCreate`,
            message: `${interaction.user.tag} ran the ${interaction.commandName} command`,
        });
        await command.execute(client, interaction);

    } else throw new ReferenceError(`Cannot find the application command file!`, { cause: `File is either missing or does not exist.` });
}

/**
 * Function to execute button commands
 * @param {Client} client The active BotClient instance
 * @param {Object} interaction The interaction object passed to the interactionCreate event
 */
async function executeButton(client, interaction) {
    const buttonIDComponent = interaction.customId.split(`_`);
    let buttonID, button, args;

    switch (buttonIDComponent.length) {
        case 1: // button is not part of a managed set
            buttonID = buttonIDComponent;
            button = client.buttons.get(buttonID);
            args = [client, interaction];
            break;

        case 2: // button is part of a managed set (second arg is function)
            buttonID = `${buttonIDComponent[0]}Manager`;
            button = client.buttons.get(buttonID);
            args = [client, interaction, buttonIDComponent[1]];
            break;
    }

    if (button) {
        client.logger.console({
            level: `INFO`,
            title: `Event - interactionCreate`,
            message: `${interaction.user.tag} clicked on the ${buttonID} button`,
        });
        await button.execute(...args);

    } else throw new ReferenceError(`Cannot find the interaction button file!`, { cause: `File is either missing or does not exist.` });
}

/**
 * Function to parse select menu arguments
 * @param {Client} client The active BotClient instance
 * @param {Object} interaction The interaction object passed to the interactionCreate event
 */
async function executeSelectMenu(client, interaction) {
    const selectMenuInteraction = client.selectMenus.get(interaction.customId);

    if (selectMenuInteraction) {
        client.logger.console({
            level: `INFO`,
            title: `Event - interactionCreate`,
            message: `${interaction.user.tag} interacted with the "${interaction.customId}" select menu!`,
        });
        await selectMenuInteraction.execute(client, interaction);
    } else throw new ReferenceError(`Cannot find the select menu file!`, { cause: `File is either missing or does not exist.` });
}