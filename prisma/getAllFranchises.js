const { prisma } = require(`./prismadb`);

module.exports = async function handler() {
    return await prisma.Franchise.findMany({
        where: {
            isActive: true,
        },
        include: {
            Team: {
                select: {
                    id: true,
                    name: true,
                    tier: true,
                }
            }
        }
    });
};
