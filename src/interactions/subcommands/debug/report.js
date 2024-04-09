const { Tier, GameType, Agent, LeagueStatus, ContractStatus } = require(`@prisma/client`);
const { prisma, Player, Team, Flags } = require(`../../../../prisma`)
const fs = require(`fs`);

console.clear();

const generate = {
    unregistered: true,
    pending: true, // get all pending
    approved: true,
    de: true,
    fa: true,
    rfa: true,
    signed: true,
    gm: true,
};

async function report(interaction) {
    let reports = [];
    if (generate.unregistered === true) reports.push(await genUnregisteredReport());
    if (generate.pending === true) reports.push(await genPendingReport());
    if (generate.approved === true) reports.push(await genApprovedReport());
    if (generate.de === true) reports.push(await genDEReport());
    if (generate.fa === true) reports.push(await genFAReport());
    if (generate.rfa === true) reports.push(await genRFAReport());
    if (generate.signed === true) reports.push(await genSignedReport());
    if (generate.gm === true) reports.push(await genGMReport());


    fs.writeFileSync(`./cache/report.txt`, reports.join(`\n\n`));
    return await interaction.editReply({ files: [`./cache/report.txt`] })
}

module.exports = { report };


async function genUnregisteredReport() {
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

async function genPendingReport() {
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

async function genApprovedReport() {
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

async function genDEReport() {
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

async function genFAReport() {
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

async function genRFAReport() {
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

async function genSignedReport() {
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

async function genGMReport() {
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