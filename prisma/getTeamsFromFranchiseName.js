const { prisma } = require(`./prismadb`);

module.exports = async function handler(franchiseName) {
    return await prisma.Team.findMany({
        where: {
            Franchise: {
                name: franchiseName
            },
        },
        include: {
            Franchise: {
                select: {
                    name: true,
                }
            }
        }
    });
};
