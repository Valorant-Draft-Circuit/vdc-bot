const { LeagueStatus, ContractStatus } = require(`@prisma/client`);
const { Player, Team, Flags } = require(`../../../../prisma`)
const { ChatInputCommandInteraction } = require(`discord.js`);
const fs = require(`fs`);
const { prisma } = require("../../../../prisma/prismadb");


async function report(/** @type ChatInputCommandInteraction */ interaction) {
    const reportType = interaction.options._hoistedOptions[0].value;

    switch (reportType) {
        case `PLAYER_LEAGUE_STATUS`: {
            const reportsArray = await generatePlayerLeagueStatusReport();
            fs.writeFileSync(`./cache/league_status_report.txt`, reportsArray.join(`\n\n`));
            return await interaction.editReply({ files: [`./cache/league_status_report.txt`] });
        };
        case `FRANCHISE_INFORMATION`: {
            return await interaction.editReply(`This is a work in prpgress!`)
            const reportJSON = await generateFranchiseInformationReport();
            return console.log(reportJSON)
            fs.writeFileSync(`./cache/franchise_information2.json`, JSON.stringify(reportJSON, ` `, 4));
            return await interaction.editReply({ files: [`./cache/franchise_information2.json`] });
        };
        case `ADMIN_TIER_LIST`: {
            const reportCSV = await generateAdminTierList();
            fs.writeFileSync(`./cache/adminTierList.csv`, reportCSV);
            return await interaction.editReply({ files: [`./cache/adminTierList.csv`] });
        };
        case `EXPIRING_CONTRACTS`: {
            const reportsArray = await generateExpiringContractReport();
            fs.writeFileSync(`./cache/expiringContracts.csv`, reportsArray.join(`\n`));
            return await interaction.editReply({ files: [`./cache/expiringContracts.csv`] });
        };
    }
    return
}

module.exports = { report };

async function generatePlayerLeagueStatusReport() {

    const genUnregisteredReport = async () => {
        let output = [
            `UNREGISTERED PLAYERS - AWAITING SIGN UPS`,
            ``.padStart(56, `-`),
            ``
        ]
        const filterPending = await Player.filterAllByStatus([LeagueStatus.UNREGISTERED]);
        output.push(...filterPending.map(fp => `${fp.name.padEnd(25)}`));

        output.push(`\n\nTOTAL: ${output.length}\n`)
        output.push(``.padStart(56, `#`))
        output.push(``.padStart(56, `#`))
        return output.join(`\n`)
    }

    const genPendingReport = async () => {
        let output = [
            `PENDING PLAYERS - AWAITING MMR`,
            ``.padStart(56, `-`),
            ``
        ]
        const filterPending = await Player.filterAllByStatus([LeagueStatus.PENDING]);
        output.push(...filterPending.map(fp => `${fp.name.padEnd(25)} | ${fp.PrimaryRiotAccount?.riotIGN?.padEnd(25)}`));

        output.push(`\n\nTOTAL: ${output.length}\n`)
        output.push(``.padStart(56, `#`))
        output.push(``.padStart(56, `#`))
        return output.join(`\n`)
    }

    const genApprovedReport = async () => {
        let output = [
            `APPROVED PLAYERS - AWAITING ACCEPTANCE`,
            ``.padStart(56, `-`),
            ``
        ]
        const filterPending = await Player.filterAllByStatus([LeagueStatus.APPROVED]);
        output.push(...filterPending.map(fp => `${fp.name.padEnd(25)} | ${fp.PrimaryRiotAccount?.riotIGN?.padEnd(25)} | ${Boolean(Number(fp.flags) & Flags.REGISTERED_AS_RFA) === true ? `RFA` : `DE`}`));

        output.push(`\n\nTOTAL: ${output.length}\n`)
        output.push(``.padStart(56, `#`))
        output.push(``.padStart(56, `#`))
        return output.join(`\n`)
    }

    const genDEReport = async () => {
        let output = [
            `DRAFT ELIGIBLE PLAYERS`,
            ``.padStart(56, `-`),
            ``
        ]
        const filterPending = await Player.filterAllByStatus([LeagueStatus.DRAFT_ELIGIBLE]);
        output.push(...filterPending.map(fp => `${fp.name.padEnd(25)} | ${fp.PrimaryRiotAccount?.riotIGN?.padEnd(25)}`));

        output.push(`\n\nTOTAL: ${output.length}\n`)
        output.push(``.padStart(56, `#`))
        output.push(``.padStart(56, `#`))
        return output.join(`\n`)
    }

    const genFAReport = async () => {
        let output = [
            `FREE AGENTS`,
            ``.padStart(56, `-`),
            ``
        ]
        const filterPending = await Player.filterAllByStatus([LeagueStatus.FREE_AGENT]);
        output.push(...filterPending.map(fp => `${fp.name.padEnd(25)} | ${fp.PrimaryRiotAccount?.riotIGN?.padEnd(25)}`));

        output.push(`\n\nTOTAL: ${output.length}\n`)
        output.push(``.padStart(56, `#`))
        output.push(``.padStart(56, `#`))
        return output.join(`\n`)
    }

    const genRFAReport = async () => {
        let output = [
            `RESTRICTED FREE AGENTS`,
            ``.padStart(56, `-`),
            ``
        ]
        const filterPending = await Player.filterAllByStatus([LeagueStatus.RESTRICTED_FREE_AGENT]);
        output.push(...filterPending.map(fp => `${fp.name.padEnd(25)} | ${fp.PrimaryRiotAccount.riotIGN.padEnd(25)}`));

        output.push(`\n\nTOTAL: ${output.length}\n`)
        output.push(``.padStart(56, `#`))
        output.push(``.padStart(56, `#`))
        return output.join(`\n`)
    }

    const genSignedReport = async () => {
        let output = [
            `SIGNED PLAYERS`,
            ``.padStart(56, `-`),
            ``
        ];
        const teams = await Team.getAllActive();
        const filterPending = await Player.filterAllByStatus([LeagueStatus.SIGNED]);
        output.push(...filterPending.map(fp => `${fp.name.padEnd(25)} | ${fp.PrimaryRiotAccount.riotIGN.padEnd(25)} | ${teams.find(t => t.id === fp.team)?.name}`));

        output.push(`\n\nTOTAL: ${output.length}\n`)
        output.push(``.padStart(56, `#`))
        output.push(``.padStart(56, `#`))
        return output.join(`\n`)
    }

    const genGMReport = async () => {
        let output = [
            `GENERAL MANAGERS`,
            ``.padStart(56, `-`),
            ``
        ]
        const filterPending = await Player.filterAllByStatus([LeagueStatus.GENERAL_MANAGER]);
        output.push(...filterPending.map(fp => `${fp.name.padEnd(25)} | ${fp.PrimaryRiotAccount.riotIGN.padEnd(25)}`));

        output.push(`\n\nTOTAL: ${output.length}\n`)
        output.push(``.padStart(56, `#`))
        output.push(``.padStart(56, `#`))
        return output.join(`\n`)
    }

    let reports = [];
    reports.push(await genUnregisteredReport());
    reports.push(await genPendingReport());
    reports.push(await genApprovedReport());
    reports.push(await genDEReport());
    reports.push(await genFAReport());
    reports.push(await genRFAReport());
    reports.push(await genSignedReport());
    reports.push(await genGMReport());
    return reports;
}

async function generateFranchiseInformationReport() {
    const franchiseData = await prisma.franchise.findMany({
        include: {
            Teams: {
                include: {
                    Roster: { include: { PrimaryRiotAccount: true, Accounts: true } },
                    Captain: { include: { PrimaryRiotAccount: true, Accounts: true } },
                },
            },
            GM: { include: { PrimaryRiotAccount: true, Accounts: true } },
            AGM1: { include: { PrimaryRiotAccount: true, Accounts: true } },
            AGM2: { include: { PrimaryRiotAccount: true, Accounts: true } },
            Brand: true,
        }
    });

    const refinedFranchiseData = franchiseData.map((fd) => {

        const getrefinedUserData = (User) => {
            User === null ? null : {
                discordName: User.name,
                discordID: User.Accounts.find(a => a.provider === `discord`).providerAccountId,
                riotIGN: User.PrimaryRiotAccount.riotIGN,
            };
        };


        const output = {
            name: fd.name,
            gm: getrefinedUserData(fd.GM),
            agms: [getrefinedUserData(fd.AGM1), getrefinedUserData(fd.AGM2)].filter(agm => agm !== null),
            brand: fd.Brand,

        };

        return output;
    })

    return refinedFranchiseData



}

async function generateAdminTierList() {
    const allPlayers = (await prisma.user.findMany({
        include: { Team: true, Status: true, PrimaryRiotAccount: { include: { MMR: true } } }
    })).filter(p => {
        if (p.Status === null) return false
        return (p.Status.leagueStatus == LeagueStatus.DRAFT_ELIGIBLE ||
            p.Status.leagueStatus == LeagueStatus.FREE_AGENT ||
            p.Status.leagueStatus == LeagueStatus.SIGNED ||
            p.Status.leagueStatus == LeagueStatus.GENERAL_MANAGER) &&
            p.PrimaryRiotAccount != null &&
            p.PrimaryRiotAccount?.MMR != null
    }).sort((a, b) => b.PrimaryRiotAccount.MMR.mmrEffective - a.PrimaryRiotAccount.MMR.mmrEffective);

    const data = allPlayers.map(p => {
        return `${Math.round(p.PrimaryRiotAccount.MMR.mmrEffective)},${p.PrimaryRiotAccount.riotIGN},${p.name},${p.Status.leagueStatus},${p.Status.contractStatus},${p.Status.contractRemaining}`
    }).join(`\n`)
    return `MMR_EFFECTIVE,RIOT_IGN,NAME,LEAGUE_STATUS,CONTRACT_STATUS,CONTRACT_REMAINING\n` + data
}

async function generateExpiringContractReport() {
    const expiringContracts = (await prisma.user.findMany({
        where: {
            Status: {
                is: {
                    contractStatus: ContractStatus.SIGNED,
                    contractRemaining: 0,
                }
            }
        },
        include: { Team: { include: { Franchise: true } } }
    })).sort((a, b) => b.team - a.team).sort((a, b) => b.Team.franchise - a.Team.franchise);

    const firstFranchise = expiringContracts[0].Team.Franchise.name
    let franciseLastSlug = expiringContracts[0].Team.Franchise.slug;
    return [firstFranchise, ...expiringContracts.map((c) => {
        const out = `${c.Team.Franchise.slug.padEnd(4, ` `)}  |  ${c.Team.name.padStart(20, ` `)} | ${c.name}`
        if (c.Team.Franchise.slug != franciseLastSlug) {
            franciseLastSlug = c.Team.Franchise.slug;
            return [`\n`, c.Team.Franchise.name, out]
        } else return out;
    }).flat()];
}
