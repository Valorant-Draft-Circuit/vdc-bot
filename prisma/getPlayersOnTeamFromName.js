const { prisma } = require(`./prismadb`);

module.exports = async function handler(name) {
    return await prisma.Team.findUnique({
        where: {
            name: name
        },
        include: {
            Player: true,
            Player: {
                include: {
                    Account: true,
                }
            }
        }
    });
};
