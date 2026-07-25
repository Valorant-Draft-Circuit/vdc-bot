const { Guild, EmbedBuilder } = require(`discord.js`);
const { ContractStatus, TransactionType } = require(`@prisma/client`);
const { Player, Transaction } = require(`../../../prisma`);
const { CHANNELS } = require(`../../../utils/enums`);
const { ACTIVE_SUB_WINDOW_MS } = require(`../../helpers/transactions/activeSubWindow`);
const { formatTeamWithTier } = require(`../../helpers/transactions/formatTeam`);
const { logTransaction } = require(`../../helpers/transactions/logTransaction`);
const { restorePairedSubbedOutPlayer } = require(`../../helpers/transactions/subbedOutPairing`);

/** End every active sub whose window has elapsed, dated from the persisted SUB
 * transaction so it self-heals across restarts.
 * @param {Guild} guild
 */
async function reconcileExpiredSubs(guild) {
	const activeSubs = (await Player.getAllSubs())
		.filter((player) => player.Status.contractStatus === ContractStatus.ACTIVE_SUB);

	// isolate each sub so one failure can't abort the rest of the pass
	for (const sub of activeSubs) {
		try {
			const latestSub = await Transaction.getLatestSub({ userID: sub.id, teamID: sub.team });
			if (latestSub == null) {
				logger.log(`WARNING`, `Active sub ${sub.id} has no SUB transaction; cannot determine expiry`);
				continue;
			}

			const hasExpired = latestSub.date.getTime() + ACTIVE_SUB_WINDOW_MS <= Date.now();
			if (hasExpired) await endExpiredSub(guild, sub.id);
		} catch (error) {
			logger.log(`ERROR`, `Sub-expiry pass failed for player ${sub.id}`, error.stack);
		}
	}
}

/** Unsub a single expired player and announce it.
 * @param {Guild} guild
 * @param {string} playerID internal database id
 */
async function endExpiredSub(guild, playerID) {
	// re-read fresh: skip if the player was signed/cut/unsubbed since the list was built
	const player = await Player.getBy({ userID: playerID });
	if (player == null || player.Status.contractStatus !== ContractStatus.ACTIVE_SUB || player.team == null) return;

	const team = player.Team;
	const franchise = team.Franchise;
	const playerTag = player.PrimaryRiotAccount.riotIGN.split(`#`)[0];
	const discordID = player.Accounts.find((account) => account.provider === `discord`)?.providerAccountId;

	const updatedPlayer = await Transaction.unsub(playerID);
	if (updatedPlayer.team !== null) {
		logger.log(`ERROR`, `Auto-unsub failed for player ${playerID}; database not updated`);
		return;
	}

	await restorePairedSubbedOutPlayer(playerID, team.id);

	await logTransaction({
		type: TransactionType.UNSUB,
		userID: playerID,
		teamID: team.id,
		franchiseID: franchise.id,
		tier: team.tier,
		details: { trigger: `auto` },
	});

	const guildMember = discordID ? await guild.members.fetch(discordID).catch(() => null) : null;
	const playerReference = guildMember ?? playerTag;

	const announcement = new EmbedBuilder({
		author: { name: `VDC Transactions Manager` },
		description: `${playerReference} (${playerTag})'s temporary contract with ${formatTeamWithTier(team)} has ended!`,
		thumbnail: {
			url: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/${franchise.Brand.logo}`,
		},
		color: 0xe92929,
		footer: { text: `Transactions — Unsub` },
		timestamp: Date.now(),
	});

	const transactionsChannel = await guild.channels.fetch(CHANNELS.TRANSACTIONS).catch(() => null);
	if (transactionsChannel == null) {
		logger.log(`ERROR`, `Auto-unsub for ${playerID} committed but transactions channel was unreachable`);
		return;
	}

	await transactionsChannel.send({ embeds: [announcement] });
	logger.log(`INFO`, `Auto-unsub ended expired sub for player ${playerID}`);
}

module.exports = { reconcileExpiredSubs };
