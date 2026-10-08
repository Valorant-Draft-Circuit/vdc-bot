const { PrismaClient, LeagueStatus } = require("@prisma/client");
const prisma = new PrismaClient();


async function rerunPendingPlayers() {
    const pendingUsers = await prisma.user.findMany({
        where: {
            Status: {
                is: {
                    leagueStatus: LeagueStatus.PENDING,
                },
            },
        },
    });

    await prisma.$disconnect(); // Disconnect the Prisma client to free up resources
    for (let i = 0; i < pendingUsers.length; i++) {
        const user = pendingUsers[i];
        await fetch(`https://numbers.vdc.gg/signup/${user.id}`, {
            method: `POST`,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: user.id }),
        }).then((res) => res.json())
        .then(async (data) => {
            console.log(data);
        }).catch((err) => {
            console.log(err);
        })
    }
}

rerunPendingPlayers();