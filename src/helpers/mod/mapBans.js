const { MatchType, LeagueStatus, ContractStatus } = require(`@prisma/client`);
const { prisma } = require(`../../../prisma/prismadb`);
const { ModLogs, ControlPanel, Team, Player } = require(`../../../prisma`);

const REGULAR_SEASON_MAPS_PER_MATCH_DAY = 2;
const PLAYOFF_MAPS_BY_MATCH_TYPE = {
	[MatchType.BO3]: 3,
	[MatchType.BO5]: 5,
};

function isEligibleToPlay(player) {
	const leagueStatus = player.Status.leagueStatus;
	const contractStatus = player.Status.contractStatus;

	if (contractStatus === ContractStatus.INACTIVE_RESERVE) return false;

	const playingStatuses = [
		LeagueStatus.FREE_AGENT,
		LeagueStatus.RESTRICTED_FREE_AGENT,
		LeagueStatus.SIGNED,
	];
	if (playingStatuses.includes(leagueStatus)) return true;

	const isPlayingGeneralManager =
		leagueStatus === LeagueStatus.GENERAL_MANAGER && contractStatus === ContractStatus.SIGNED;
	return isPlayingGeneralManager;
}

async function resolvePlayerTier(player) {
	if (player.team != null) {
		const team = await Team.getBy({ id: player.team });
		return team.tier;
	}

	const mmrEffective = player.PrimaryRiotAccount?.MMR?.mmrEffective;
	if (mmrEffective == null) return null;

	const tierLines = await ControlPanel.getMMRCaps(`PLAYER`);
	const matchedTier = Object.keys(tierLines).find(
		(tier) => tierLines[tier].min <= mmrEffective && mmrEffective <= tierLines[tier].max
	);
	return matchedTier ?? null;
}

async function countMapsServed({ tier, teamID, since }) {
	if (teamID != null) {
		return await prisma.games.count({
			where: {
				tier: tier,
				datePlayed: { gt: since },
				Match: {
					matchType: { in: [MatchType.BO2, MatchType.BO3, MatchType.BO5] },
					OR: [{ home: teamID }, { away: teamID }],
				},
			},
		});
	}

	const tierMatches = await prisma.matches.findMany({
		where: { tier: tier, matchType: MatchType.BO2, matchDay: { not: null } },
		select: { season: true, matchDay: true, Games: { select: { datePlayed: true } } },
	});
	return countCompletedMatchDayMaps(tierMatches, since);
}

// teamless players serve an MD only once every match of it has been played,
// so a single rescheduled match holds the whole MD open
function countCompletedMatchDayMaps(tierMatches, since) {
	const matchDays = new Map();
	for (const match of tierMatches) {
		const key = `${match.season}:${match.matchDay}`;
		if (!matchDays.has(key)) matchDays.set(key, []);
		matchDays.get(key).push(match);
	}

	let mapsServed = 0;
	for (const dayMatches of matchDays.values()) {
		const everyMatchPlayed = dayMatches.every((match) => match.Games.length > 0);
		if (!everyMatchPlayed) continue;

		const completedAt = Math.max(...dayMatches.flatMap((match) => match.Games.map((game) => game.datePlayed.getTime())));
		if (completedAt > since.getTime()) mapsServed += REGULAR_SEASON_MAPS_PER_MATCH_DAY;
	}

	return mapsServed;
}

function parseDetails(row) {
	if (row.details == null) return {};
	try {
		return JSON.parse(row.details);
	} catch {
		return {};
	}
}

async function getMapBanState(discordID, player) {
	const rows = await ModLogs.mapBansFor(discordID);
	if (rows.length === 0) return { totalRemaining: 0, bans: [] };

	const tier = player ? await resolvePlayerTier(player) : null;

	const bans = [];
	for (const row of rows) {
		const details = parseDetails(row);
		if (details.mapCount == null) continue;

		const servedAtFreeze = details.servedAtFreeze ?? 0;
		let served = servedAtFreeze;
		if (details.frozen !== true && tier != null) {
			const tickingSince = details.resumedAt ? new Date(details.resumedAt) : row.date;
			served += await countMapsServed({ tier, teamID: player?.team ?? null, since: tickingSince });
		}

		const remaining = Math.max(0, details.mapCount - served);
		bans.push({ row, details, remaining });
	}

	const totalRemaining = bans.reduce((sum, ban) => sum + ban.remaining, 0);
	return { totalRemaining, bans };
}

async function freezeMapBans(discordID, player) {
	const state = await getMapBanState(discordID, player);
	for (const ban of state.bans) {
		if (ban.remaining <= 0 || ban.details.frozen === true) continue;
		await ModLogs.updateDetails(ban.row.id, {
			...ban.details,
			servedAtFreeze: ban.details.mapCount - ban.remaining,
			frozen: true,
		});
	}
}

async function unfreezeMapBans(discordID) {
	const rows = await ModLogs.mapBansFor(discordID);
	for (const row of rows) {
		const details = parseDetails(row);
		if (details.mapCount == null || details.frozen !== true) continue;
		await ModLogs.updateDetails(row.id, {
			...details,
			frozen: false,
			resumedAt: new Date().toISOString(),
		});
	}
}

// a lifted ban is marked fully served and pre-stamped as announced,
// so the reconcile sweep never posts a "fully served" message for it
async function liftMapBans(discordID, liftNote) {
	const player = await Player.getBy({ discordID }).catch(() => null);
	const state = await getMapBanState(discordID, player);

	let liftedMaps = 0;
	for (const ban of state.bans) {
		if (ban.remaining <= 0) continue;

		liftedMaps += ban.remaining;
		await ModLogs.updateDetails(ban.row.id, {
			...ban.details,
			servedAtFreeze: ban.details.mapCount,
			frozen: false,
			servedAnnouncedAt: new Date().toISOString(),
		});
		await ModLogs.appendNote(ban.row.id, liftNote);
	}

	return liftedMaps;
}

async function sweepServedMapBans() {
	const rows = await ModLogs.allMapBans();

	const rowsByPlayer = new Map();
	for (const row of rows) {
		const details = parseDetails(row);
		if (details.mapCount == null) continue;
		if (!rowsByPlayer.has(row.discordID)) rowsByPlayer.set(row.discordID, []);
		rowsByPlayer.get(row.discordID).push({ row, details });
	}

	const served = [];
	for (const [discordID, playerBans] of rowsByPlayer) {
		const unannounced = playerBans.filter((ban) => ban.details.servedAnnouncedAt == null);
		if (unannounced.length === 0) continue;

		const player = await Player.getBy({ discordID }).catch(() => null);
		const state = await getMapBanState(discordID, player);
		if (state.totalRemaining > 0) continue;

		served.push({
			discordID,
			mapsServed: unannounced.reduce((sum, ban) => sum + ban.details.mapCount, 0),
			markAnnounced: async () => {
				for (const ban of unannounced) {
					await ModLogs.updateDetails(ban.row.id, {
						...ban.details,
						servedAnnouncedAt: new Date().toISOString(),
					});
				}
			},
		});
	}

	return served;
}

function fallbackEligibilityLine(remainingMaps) {
	const mapsWord = remainingMaps === 1 ? `map` : `maps`;
	return `Because of this ban you will be ineligible to play for your next ${remainingMaps} ${mapsWord}.`;
}

async function buildEligibilityLine({ player, remainingMaps }) {
	if (remainingMaps <= 0) return null;
	if (player == null) return fallbackEligibilityLine(remainingMaps);

	if (!isEligibleToPlay(player)) {
		const mapsWord = remainingMaps === 1 ? `map` : `maps`;
		return `Because you are not currently an active player, this ban begins counting down when you return to active status. You will then be ineligible for your next ${remainingMaps} ${mapsWord}.`;
	}

	const tier = await resolvePlayerTier(player);
	if (tier == null) return fallbackEligibilityLine(remainingMaps);

	const upcomingMatches = await prisma.matches.findMany({
		where: {
			tier: tier,
			dateScheduled: { gt: new Date() },
			matchType: { in: [MatchType.BO2, MatchType.BO3, MatchType.BO5] },
		},
		orderBy: { dateScheduled: `asc` },
	});

	const banSlots = [];
	if (player.team != null) {
		for (const match of upcomingMatches) {
			if (match.matchDay == null || (match.home !== player.team && match.away !== player.team)) continue;
			const maps = match.matchType === MatchType.BO2
				? REGULAR_SEASON_MAPS_PER_MATCH_DAY
				: PLAYOFF_MAPS_BY_MATCH_TYPE[match.matchType];
			banSlots.push({ matchDay: match.matchDay, maps });
		}
	} else {
		const seenMatchDays = new Set();
		for (const match of upcomingMatches) {
			if (match.matchType !== MatchType.BO2 || match.matchDay == null || seenMatchDays.has(match.matchDay)) continue;
			seenMatchDays.add(match.matchDay);
			banSlots.push({ matchDay: match.matchDay, maps: REGULAR_SEASON_MAPS_PER_MATCH_DAY });
		}
	}

	let mapsLeft = remainingMaps;
	let lastFullyBannedMatchDay = null;
	for (let i = 0; i < banSlots.length; i++) {
		const slot = banSlots[i];

		if (mapsLeft < slot.maps) {
			const partialMaps = mapsLeft === 1 ? `Map 1` : `Maps 1-${mapsLeft}`;
			const throughPart = lastFullyBannedMatchDay === null
				? ``
				: `through Match Day ${lastFullyBannedMatchDay}, plus `;
			return `Because of this ban you will be ineligible to play ${throughPart}${partialMaps} of Match Day ${slot.matchDay}.`;
		}

		mapsLeft -= slot.maps;
		lastFullyBannedMatchDay = slot.matchDay;
		if (mapsLeft === 0) {
			const nextSlot = banSlots[i + 1];
			const eligibleMatchDay = nextSlot ? nextSlot.matchDay : slot.matchDay + 1;
			return `Because of this ban you will be ineligible to play until Match Day ${eligibleMatchDay}.`;
		}
	}

	const mapsWord = remainingMaps === 1 ? `map` : `maps`;
	const coveredPart = lastFullyBannedMatchDay === null
		? ``
		: ` This covers the remaining schedule through Match Day ${lastFullyBannedMatchDay} and carries ${mapsLeft} ${mapsLeft === 1 ? `map` : `maps`} forward.`;
	return `Because of this ban you will be ineligible to play for your next ${remainingMaps} ${mapsWord}.${coveredPart}`;
}

module.exports = {
	isEligibleToPlay,
	resolvePlayerTier,
	countMapsServed,
	countCompletedMatchDayMaps,
	getMapBanState,
	freezeMapBans,
	unfreezeMapBans,
	liftMapBans,
	sweepServedMapBans,
	buildEligibilityLine,
};
