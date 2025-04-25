const { ChatInputCommandInteraction } = require(`discord.js`);
const { ROLES } = require(`../../../utils/enums/roles`)


module.exports = {

    name: `report`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply({ ephemeral: true });

        // const user = interaction.member;
        // const userRoles = user.roles.cache.map(r => r.id);



        // console.log(interaction.member.roles.cache.map(r => r.id).includes(ROLES.OPERATIONS.ADMIN));
        // if ()

        return await interaction.editReply({ content: `This is a work in progress!` });
    }
};
