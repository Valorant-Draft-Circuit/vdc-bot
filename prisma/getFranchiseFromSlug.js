const { prisma } = require(`./prismadb`);

module.exports = async function handler(slug) {
    return await prisma.Franchise.findUnique({
        where: { slug: slug },
    });
};
