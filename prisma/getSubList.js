const { prisma } = require(`./prismadb`);

/**
 * 
 * @param {Contender|Advanced|Master|Elite} tier 
 * @returns 
 */
module.exports = async function handler(tier) {
    console.log(tier)

    return prisma.PlayerReplica.findMany({
        where: {
            OR: [
                {
                  franchise: {
                    equals: 14,
                  },
                },
                {
                  franchise: {
                    equals: 15,
                  },
                },
                {
                  franchise: {
                    equals: 16,
                  },
                },
              ],
        }});
        // console.log(subs)
};
