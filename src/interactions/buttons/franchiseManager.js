const { ButtonInteraction, EmbedBuilder } = require(`discord.js`);
const { ButtonOptions } = require(`../../../utils/enums`);
const { updateDescription } = require("../subcommands/franchise");

module.exports = {
    id: `franchiseManager`,

    async execute(/** @type ButtonInteraction */ interaction, args) {
        await interaction.deferReply(); // defer as early as possible

        const splitargs = args.split(`-`);
        switch (splitargs[0]) {
            case `cancel`: {
                return await cancel(interaction);
            }
            case `descupdate`: {
                return await updateDescription.finalize(interaction, splitargs[1]);
            }
        }
    }
};


async function cancel(/** @type ChatInputCommandInteraction */ interaction) {
    // delete the reply and then edit the original embed to show cancellation confirmation
    await interaction.deleteReply();

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);

    embedEdits.setDescription(`This operation was cancelled.`);
    embedEdits.setFields([]);

    return await interaction.message.edit({
        embeds: [embedEdits],
        components: [],
    });
}
