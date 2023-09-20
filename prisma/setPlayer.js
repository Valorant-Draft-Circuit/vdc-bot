const { prisma } = require(`./prismadb`);

module.exports = async function handler(playerData) {
    const { discordID, teamID, status, mmr } = playerData;
    console.log(playerData)
    return await prisma.PlayerReplica.create({
        data: {
            id: String(discordID),
            team: teamID,
            isRegistered: status,
            MMR: mmr
        },
    })
};