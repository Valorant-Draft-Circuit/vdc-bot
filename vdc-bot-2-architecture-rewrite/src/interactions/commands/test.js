const { prisma } = require('../../../prisma/prismadb');
const sum = (array) => array.reduce((s, v) => s += v == null ? 0 : v, 0);

module.exports = {

    name: 'test',
    async execute(interaction) {
        interaction.reply({ content: 'testing...' });

        console.log([sum([0, 1, 2, 3, 4])])
    }
};