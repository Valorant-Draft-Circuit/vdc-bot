const { ContractStatus } = require(`@prisma/client`);
const { prisma } = require(`../../../../prisma/prismadb`);

module.exports = {
    name: `expiring-contracts`,
    readable: `Expiring Contracts`,

    helpResponse: [
        `Use the \`Expiring Contracts\` report to view all the expiring contracts`,
    ].join(`\n\n`),

    async generate() {

        const expiringContracts = (await prisma.user.findMany({
            where: {
                Status: {
                    is: {
                        contractStatus: ContractStatus.SIGNED,
                        contractRemaining: 0,
                    }
                }
            },
            include: { Team: { include: { Franchise: true } }, PrimaryRiotAccount: true }
        })).sort((a, b) => b.team - a.team).sort((a, b) => b.Team.franchise - a.Team.franchise);

        let out = `Expiring Contracts (${expiringContracts.length})\n`;
        if (!expiringContracts.length) return { text: `No expiring contracts found` };

        const uniqueFranchises = [...new Set(expiringContracts.map(c => c.Team.Franchise.name))];

        out += `${``.padEnd(65, `—`)}\n\n`;
        for (let i = 0; i < uniqueFranchises.length; i++) {
            const franchise = uniqueFranchises[i];

            out += `${`${franchise} (${expiringContracts.filter(c => c.Team.Franchise.name == franchise).length})\n`}`;

            out += `${``.padEnd(25, `—`)}\n`;
            out += expiringContracts.filter(c => c.Team.Franchise.name == franchise).map(c => `${c.Team.tier[0]} | ${c.name.padEnd(20, ` `)} | ${c.PrimaryRiotAccount.riotIGN.padEnd(20, ` `)}`).join(`\n`);
            if (i < uniqueFranchises.length - 1) out += `\n\n\n\n`;
        }

        return { text: out };
    }
}