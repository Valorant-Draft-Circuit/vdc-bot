const { prisma } = require(`./prismadb`);

module.exports = async function handler(discordId) {
    return await prisma.playerStats.findMany({
        where: {
            Player: {
                id: discordId
            }
        },
        include: {
            Player: {
                select: {
                    Account: {
                        select: {
                            riotID: true,
                        }
                    }
                }
            }
        }
    });
};
