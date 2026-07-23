const { Client, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { VetoSource } = require(`@prisma/client`);
const { prisma } = require(`../../../prisma/prismadb`);
const { ControlPanelID } = require(`../../../prisma/enums/_controlpanel`);
const { CHANNELS } = require(`../../../utils/enums/channels`);
const { deriveVetoState } = require(`./flow`);

const POLL_INTERVAL_MS = 30 * 1000;
const DEFAULT_ESCALATION_MINUTES = 30;
const FINAL_TIER = 4;

/** `matchID:rowId` -> { phase, tier, lastEscalatedAt, acked }; in-memory, so a
 *  restart re-pages the live turn from tier 0 (desired). */
const activePages = new Map();

const managementInclude = { include: { Accounts: true } };
const teamInclude = {
    include: {
        Franchise: {
            include: {
                Brand: true,
                GM: managementInclude,
                AGM1: managementInclude,
                AGM2: managementInclude,
                AGM3: managementInclude,
                AGM4: managementInclude
            }
        },
        Roster: { include: { Accounts: true } },
        Captain: { include: { Accounts: true } }
    }
};

/** Start the web veto pager: polls web-owned vetos and escalates unanswered turns.
 * @param {Client} client
 */
function startWebVetoAnnouncer(client) {
    setInterval(async () => {
        try {
            await tick(client);
        } catch (error) {
            if (`${error.message}`.includes(`Engine is not yet connected`)) {
                logger.log(`VERBOSE`, `Web veto pager tick skipped: database engine not connected yet, retrying next poll`);
            } else {
                logger.log(`ERROR`, `Web veto pager tick failed`, error.stack);
            }
        }
    }, POLL_INTERVAL_MS);
    logger.log(`INFO`, `Web veto pager started (${POLL_INTERVAL_MS / 1000}s poll, ${DEFAULT_ESCALATION_MINUTES}m default escalation)`);
}

/** Record an ack for a turn's page. Returns true when it stopped a live page,
 *  false when the page was already acked or no longer exists. */
function acknowledgeTurn(matchID, rowId, userTag) {
    const pageState = activePages.get(pageKey(matchID, rowId));
    if (!pageState || pageState.acked) return false;
    pageState.acked = true;
    logger.log(`INFO`, `\`${userTag}\` acknowledged the web veto page for match \`${matchID}\` (row \`${rowId}\`)`);
    return true;
}

/** Fail closed on the switches: paging stays off until the enable row explicitly
 *  reads "true", and stays off while the staff-only row is missing or reads "true".
 *  Fail safe on the interval: a missing, non-numeric, or sub-minute row falls back
 *  to the 30-minute default. */
async function readPagerControls() {
    const flagRows = await prisma.controlPanel.findMany({
        where: { id: { in: [ControlPanelID.WEB_MAPBANS_ENABLED, ControlPanelID.WEB_MAPBANS_STAFF_ONLY, ControlPanelID.WEB_MAPBANS_PAGER_MINUTES] } }
    });
    const enabledRow = flagRows.find(row => row.id === ControlPanelID.WEB_MAPBANS_ENABLED);
    const staffOnlyRow = flagRows.find(row => row.id === ControlPanelID.WEB_MAPBANS_STAFF_ONLY);
    const pagerMinutesRow = flagRows.find(row => row.id === ControlPanelID.WEB_MAPBANS_PAGER_MINUTES);
    const enabled = enabledRow?.value === `true`;
    const staffOnly = staffOnlyRow?.value ? staffOnlyRow.value === `true` : true;
    const parsedMinutes = parseInt(pagerMinutesRow?.value, 10);
    const escalationMinutes = Number.isNaN(parsedMinutes) || parsedMinutes < 1
        ? DEFAULT_ESCALATION_MINUTES
        : parsedMinutes;
    return {
        pagingEnabled: enabled && !staffOnly,
        escalationIntervalMs: escalationMinutes * 60 * 1000
    };
}

async function tick(client) {
    const pagerControls = await readPagerControls();
    if (!pagerControls.pagingEnabled) {
        activePages.clear();
        return;
    }

    const webRows = await prisma.mapBans.findMany({
        where: { source: VetoSource.WEB },
        include: {
            Match: {
                include: {
                    Home: teamInclude,
                    Away: teamInclude
                }
            }
        }
    });

    const byMatch = new Map();
    for (const row of webRows) {
        const group = byMatch.get(row.matchID) ?? [];
        group.push(row);
        byMatch.set(row.matchID, group);
    }

    for (const [matchID, rows] of byMatch) {
        const state = deriveVetoState(rows);
        const match = rows[0].Match;
        const actingTeam = state.actingTeamId == match.Home.id ? match.Home
            : state.actingTeamId == match.Away.id ? match.Away : null;

        if (state.currentRow == null || actingTeam == null) {
            cancelMatchPages(matchID);
            continue;
        }

        const key = pageKey(matchID, state.currentRow.id);
        cancelMatchPages(matchID, key);

        let pageState = activePages.get(key);
        if (pageState && pageState.phase != state.phase) pageState = null;

        if (!pageState) {
            pageState = { phase: state.phase, tier: 0, lastEscalatedAt: 0, acked: false };
            activePages.set(key, pageState);
            await deliverFromCurrentTier(client, pageState, matchID, rows, state, actingTeam);
            continue;
        }

        if (pageState.acked || pageState.tier > FINAL_TIER) continue;
        if (Date.now() - pageState.lastEscalatedAt < pagerControls.escalationIntervalMs) continue;

        pageState.tier += 1;
        await deliverFromCurrentTier(client, pageState, matchID, rows, state, actingTeam);
    }

    for (const key of activePages.keys()) {
        const matchID = Number(key.split(`:`)[0]);
        if (!byMatch.has(matchID)) activePages.delete(key);
    }
}

/** Attempt delivery at the page's current tier; a tier with zero deliverable
 *  recipients escalates immediately instead of waiting out the interval. */
async function deliverFromCurrentTier(client, pageState, matchID, rows, state, actingTeam) {
    while (pageState.tier <= FINAL_TIER) {
        const delivered = await deliverTier(client, pageState.tier, matchID, rows, state, actingTeam);
        if (delivered) {
            pageState.lastEscalatedAt = Date.now();
            return;
        }
        pageState.tier += 1;
    }
    logger.log(`ERROR`, `Web veto page for match \`${matchID}\` exhausted every tier without a delivery`);
}

async function deliverTier(client, tier, matchID, rows, state, actingTeam) {
    const content = buildPageContent(matchID, rows, state, actingTeam);
    const components = [buildAckRow(matchID, state.currentRow.id)];

    if (tier == FINAL_TIER) {
        const channel = await client.channels.fetch(CHANNELS.ADMIN_BOT_INPUT).catch(() => null);
        if (!channel) {
            logger.log(`ERROR`, `Web veto escalation channel ${CHANNELS.ADMIN_BOT_INPUT} not found`);
            return false;
        }
        await channel.send({ content: `${content}\nEvery team contact was paged without a response.`, components: components });
        return true;
    }

    const recipientDiscordIds = tierRecipientDiscordIds(tier, actingTeam);
    let deliveredCount = 0;
    for (const discordId of recipientDiscordIds) {
        const sent = await client.users.fetch(discordId)
            .then(user => user.send({ content: content, components: components }))
            .catch(() => null);
        if (sent) deliveredCount += 1;
    }
    return deliveredCount > 0;
}

function tierRecipientDiscordIds(tier, actingTeam) {
    if (tier == 0) return discordAccountIds([actingTeam.Captain]);
    if (tier == 1) return discordAccountIds(actingTeam.Roster.filter(player => player.id != actingTeam.captain));
    if (tier == 2) return discordAccountIds([actingTeam.Franchise.AGM1, actingTeam.Franchise.AGM2, actingTeam.Franchise.AGM3, actingTeam.Franchise.AGM4]);
    if (tier == 3) return discordAccountIds([actingTeam.Franchise.GM]);
    return [];
}

function discordAccountIds(users) {
    return users
        .filter(user => user != null)
        .map(user => user.Accounts.find(account => account.provider == `discord`))
        .filter(account => account != null)
        .map(account => account.providerAccountId);
}

function buildPageContent(matchID, rows, state, actingTeam) {
    const match = rows[0].Match;
    const vetoUrl = rows.find(r => r.vetoUrl != null)?.vetoUrl ?? `https://vdc.gg/match/${matchID}`;
    const header = `<${match.Home.Franchise.Brand.discordEmote}> \`${match.Home.name}\` vs. <${match.Away.Franchise.Brand.discordEmote}> \`${match.Away.name}\` (\`${match.tier}\`)`;
    const turnText = state.phase === `map-turns`
        ? `turn to \`${state.currentRow.type}\``
        : `turn to pick a side on \`${state.currentRow.map}\``;
    return `Web map bans: ${header}\nIt's <${actingTeam.Franchise.Brand.discordEmote}> \`${actingTeam.name}\`'s ${turnText} on the website: ${vetoUrl}`;
}

function buildAckRow(matchID, rowId) {
    return new ActionRowBuilder({
        components: [new ButtonBuilder({
            customId: `webveto_ack-${matchID}-${rowId}`,
            label: `Acknowledge`,
            style: ButtonStyle.Primary
        })]
    });
}

function cancelMatchPages(matchID, keepKey) {
    for (const key of activePages.keys()) {
        if (key.startsWith(`${matchID}:`) && key !== keepKey) activePages.delete(key);
    }
}

function pageKey(matchID, rowId) {
    return `${matchID}:${rowId}`;
}

module.exports = { startWebVetoAnnouncer, acknowledgeTurn };
