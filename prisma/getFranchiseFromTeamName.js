const { prisma } = require(`./prismadb`);

module.exports = async function handler(teamName) {
    return prisma.Franchise.findMany({
        where: { 
            Team: {
                name: teamName,
            }
        },
    });
};