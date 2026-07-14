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
	const playedGames = await prisma.games.findMany({
		where: {
			tier: tier,
			datePlayed: { gt: since },
			matchID: { not: null },
		},
		select: {
			Match: { select: { matchType: true, matchDay: true, home: true, away: true } },
		},
	});

	const regularSeasonMatchDays = new Set();
	let playoffMapsServed = 0;
	for (const game of playedGames) {
		if (game.Match == null) continue;

		if (game.Match.matchType === MatchType.BO2) {
			if (game.Match.matchDay != null) regularSeasonMatchDays.add(game.Match.matchDay);
		} else if (PLAYOFF_MAPS_BY_MATCH_TYPE[game.Match.matchType] !== undefined) {
			const teamPlayedIt = teamID != null && (game.Match.home === teamID || game.Match.away === teamID);
			if (teamPlayedIt) playoffMapsServed += 1;
		}
	}

	return regularSeasonMatchDays.size * REGULAR_SEASON_MAPS_PER_MATCH_DAY + playoffMapsServed;
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
	const seenMatchDays = new Set();
	for (const match of upcomingMatches) {
		if (match.matchType === MatchType.BO2) {
			if (match.matchDay == null || seenMatchDays.has(match.matchDay)) continue;
			seenMatchDays.add(match.matchDay);
			banSlots.push({ matchDay: match.matchDay, maps: REGULAR_SEASON_MAPS_PER_MATCH_DAY });
		} else if (player.team != null && match.matchDay != null && (match.home === player.team || match.away === player.team)) {
			banSlots.push({ matchDay: match.matchDay, maps: PLAYOFF_MAPS_BY_MATCH_TYPE[match.matchType] });
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
	getMapBanState,
	freezeMapBans,
	unfreezeMapBans,
	sweepServedMapBans,
	buildEligibilityLine,
};
