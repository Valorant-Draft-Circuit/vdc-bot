const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, UserSelectMenuBuilder } = require("discord.js");

const { FranchiseEmote, TransactionsSubTypes, ContenderTeams, AdvancedTeams, MasterTeams, EliteTeams, Tier, TransactionsCutOptions, TransactionsSignOptions } = require(`../../utils/enums`);



const { getAllFranchises, getFranchiseFromSlug, getTeamsFromFranchiseName, getFranchiseFromTeamName, getPlayersOnTeamFromName, getSubList } = require(`../../prisma`);


const tiers = [ContenderTeams, AdvancedTeams, MasterTeams, EliteTeams];

module.exports = {

    id: `transactionsManager`,

    async execute(interaction, args) {
        console.log(args)
        console.log(TransactionsSignOptions.CANCEL)

        switch (Number(args)) {
        //  CONFIRM BUTTONS  ###################################
            case TransactionsSignOptions.CONFIRM:
                confirmSign(interaction);
                break;
            case TransactionsCutOptions.CONFIRM:
                confirmCut(interaction);
                break;

        //  CANCEL BUTTONS  ####################################
            case TransactionsSignOptions.CANCEL:
            case TransactionsCutOptions.CANCEL:
                cancel(interaction);
                break

            default:
                interaction.reply({content: `There was an error. ERR: BTN_TSC_MGR`});
                break;
        }


    }
};

async function confirmSign(interaction) {

    interaction.reply({ content: `confirm sign` });
}

async function confirmCut(interaction) {
    const playerID = interaction.message.embeds[0].fields[1].value.replace(`\``, ``).split(`\n`)[2];

    
    interaction.reply({ content: `confirm cut` });
}

async function cancel(interaction) {
    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);

    embedEdits.setDescription(`This operation was cancelled.`);
    embedEdits.setFields([]);

    interaction.message.edit({ embeds: [embedEdits], components: [] });

    interaction.deferUpdate();
}