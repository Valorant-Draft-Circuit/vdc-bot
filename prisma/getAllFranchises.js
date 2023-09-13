const { prisma } = require(`./prismadb`);

module.exports = async function handler() {
    return await prisma.Franchise.findMany({
        where: {
            isActive: true,
        }
    });
};