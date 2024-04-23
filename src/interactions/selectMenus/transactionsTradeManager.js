const { StringSelectMenuInteraction } = require(`discord.js`);
const { trade } = require(`../../interactions/subcommands/transactions`);
const { prisma } = require("../../../prisma/prismadb");


module.exports = {

    id: `transactionsTradeManager`,

    async execute(/** @type StringSelectMenuInteraction */ interaction) {
        await interaction.deferUpdate();
        const { customId, values } = interaction;

        const args = customId.split(`_`);
        const franchiseSelection = Number(args[1].replace(`F`, ``));
        const type = args[2][0] === `P` ? `PLAYER` : `DRAFT_PICK`;

        if (type == `PLAYER`) {
            return await trade.playerTradeRequest(interaction, franchiseSelection, values);
        } else {
            return await trade.draftPickTradeRequest(interaction, franchiseSelection, values);
        }
    }
};