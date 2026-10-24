const { GameType, MatchType } = require(`@prisma/client`);
const { Games, ControlPanel, Player } = require(`../../../prisma`);
const { prisma } = require(`../../../prisma/prismadb`);
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, time, TimestampStyles, userMention } = require(`discord.js`);
const {
   resolveQueueSubmissionContext,
   resolveQueueContextFromPlayers,
   finalizeQueueCombineSubmission,
   deleteQueueMatchChannels,
} = require(`../../core/queue/matchLifecycle`);
const { playerKey } = require(`../../helpers/queue/queueKeys`);
const { detectMatches, submitGame } = require(`../../helpers/numbers`);
const { getRedisClient } = require(`../../core/redis`);
const { acquireMatchSubmitLock, refreshMatchSubmitLock, releaseMatchSubmitLock } = require(`../../helpers/submitLock`);
const {
   DETECT_STATE_TTL_SECONDS,
   reasonMessage,
   buildAlreadySubmittedEmbed,
   detectStateKey,
   buildCandidateEmbed,
   buildCombineCandidateEmbed,
   isSubmittable,
} = require(`../../helpers/submitDetect`);

const validMatchRegex = /^https:\/\/tracker.gg\/valorant\/match\/([a-z0-9]{8})-([a-z0-9]{4}-){3}([a-z0-9]{12})$/;
const iconURL = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/vdc-logos/champwall.png`;
const riotMatchesV1 = `https://na.api.riotgames.com/val/match/v1/matches`;

module.exports = {

   name: `submit`,

   async execute(/** @type ChatInputCommandInteraction */ interaction) {
      await interaction.deferReply();

      const url = interaction.options.getString(`url`);
      const submittedTier = interaction.options.getString(`tier`);

      const state = await ControlPanel.getLeagueState();
      let type;
      if (state === `COMBINES`) type = GameType.COMBINE;
      else if (state === `REGULAR_SEASON`) type = GameType.SEASON;
      else if (state === `PLAYOFFS`) type = GameType.PLAYOFF;
      else return await interaction.editReply({ content: `VDC is not accepting match submissions at this time. If you believe this is an error, please open a tech ticket.` });

      if (url) return await submitFromLink(interaction, { url, submittedTier, type });
      return await submitFromAutoDetection(interaction, { type });
   }
};

/** Legacy path: submit a single game from a tracker.gg link. */
async function submitFromLink(interaction, { url, submittedTier, type }) {
   if (!validMatchRegex.test(url)) return await interaction.editReply({ content: `That doesn't look like a valid match URL. Please try again or open a tech ticket.` });

   // per-step timings, logged with the submission to track down slow submits
   const timings = [];
   let lastMark = Date.now();
   const mark = (label) => { const now = Date.now(); timings.push(`${label}=${now - lastMark}ms`); lastMark = now; };

   const gameID = url.replace(`https://tracker.gg/valorant/match/`, ``);
   const exists = await Games.exists({ id: gameID });
   mark(`db`);
   if (exists) return await interaction.editReply({ content: `Looks like this match was already submitted.` });

   const response = await fetch(`${riotMatchesV1}/${gameID}?api_key=${process.env.VDC_API_KEY}`);
   const data = await response.json();
   mark(`riot`);
   if (data.matchInfo === undefined) return await interaction.editReply({ content: `There was a problem checking Riot's servers. Please try again or open a tech ticket.` });
   if (data.matchInfo.provisioningFlowId !== `CustomGame`) return await interaction.editReply({ content: `The match you submitted ([\`${gameID}\`](${url})) doesn't look like a custom game. Please double check your match and try again.` });

   // Teammates often submit the same link seconds apart, before numbers has stored the game. Only the
   // first gets through; the rest used to run without a queue match and look like the queue was skipped.
   const redis = getRedisClient();
   const claimKey = gameSubmitClaimKey(gameID);
   const claimed = await redis.set(claimKey, interaction.user.id, `EX`, GAME_SUBMIT_CLAIM_TTL_SECONDS, `NX`).catch(() => `OK`);
   if (claimed !== `OK`) {
      const claimant = await redis.get(claimKey).catch(() => null);
      return await interaction.editReply({
         content: `${claimant ? `<@${claimant}>` : `Someone`} already submitted this match, so you're all set.`,
         allowedMentions: { parse: [] },
      });
   }
   const releaseClaim = () => redis.del(claimKey).catch(() => undefined);

   const queueContext = type === GameType.COMBINE
      ? await resolveCombineQueueContext(interaction.user.id, data, gameID)
      : null;
   mark(`queue`);
   const tier = queueContext?.tier ?? submittedTier;

   if (!tier) {
      await releaseClaim();
      const content = type === GameType.COMBINE
         ? `I couldn't match that game to an open queue match, so it won't close one. If it's from an earlier queue match that never got recorded, resubmit it with the \`tier\` option.`
         : `Please include the \`tier\` option when submitting with a link.`;
      return await interaction.editReply({ content });
   }

   const numbers = await sendToNumbers({ id: gameID, tier: tier, type: type }, {
      // the lobby is closed by then; tell the submitter so a lost game gets a ticket instead of a resubmit
      onLateRejection: (error) => {
         const content = `<@${interaction.user.id}> the match processor rejected [\`${gameID}\`](${url})${error.reason ? ` (\`${error.reason}\`)` : ``}, so it was **not** recorded. Please open a tech ticket instead of resubmitting it.`;
         // a submit run in the lobby's chat has no channel left to follow up in
         return interaction.followUp({ content, allowedMentions: { users: [interaction.user.id] } })
            .catch(() => interaction.user.send({ content }))
            .catch(() => undefined);
      },
   });
   mark(`numbers`);
   if (!numbers.ok) {
      await releaseClaim();
      const content = numbers.reason
         ? `The match processor rejected your match (\`${numbers.reason}\`), so it was not submitted. Please open a tech ticket.`
         : `I couldn't reach the match processor, so your match was not submitted. Please try again in a moment or open a tech ticket.`;
      return await interaction.editReply({ content });
   }

   let combineFinalized = false;
   if (type === GameType.COMBINE && queueContext) {
      combineFinalized = await finalizeQueueCombineSubmission({
			userId: interaction.user.id,
      queueContext,
      gameID,
      url,
      });
      mark(`finalize`);
   }
   timings.push(`total=${Date.now() - interaction.createdTimestamp}ms`);

   const queueStatus = type !== GameType.COMBINE
      ? null
      : combineFinalized ? `Marked for deletion + players unlocked` : `No open queue match found`;

   const embed = new EmbedBuilder({
      author: { name: `VDC Match Submission` },
      description: `Your match was successfully submitted!`,
      thumbnail: { url: iconURL },
      color: 0xE92929,
      fields: [
         {
            name: ``,
            value: `Tier:\nType:\nMatch ID:${queueStatus ? `\nQueue:` : ``}`,
            inline: true
         },
         {
            name: ``,
            value: `${tier}\n${type}\n[\`${gameID}\`](${url})${queueStatus ? `\n${queueStatus}` : ``}`,
            inline: true
         }
      ],
      footer: { text: `Valorant Draft Circuit — Match Result Submissions` }
   });

   logger.matchdrain(`${time(Math.round(Date.now() / 1000), TimestampStyles.ShortDate)} ${time(Math.round(Date.now() / 1000), TimestampStyles.MediumTime)} **Match submission** - __Tier__: \`${tier}\`, __Type__: \`${type}\`, __Match ID__: [\`${gameID}\`](${url})`);
   logger.log(`VERBOSE`, `Match submission - Tier: \`${tier}\`, Type: \`${type}\`, Match ID: [\`${gameID}\`](${url}) - Timings: ${timings.join(`, `)}`);
   try {
      return await interaction.editReply({ embeds: [embed] });
   } finally {
      if (combineFinalized) await deleteQueueMatchChannels(interaction.guild, queueContext);
   }
}

// outlasts numbers processing the game, after which Games.exists catches repeats
const GAME_SUBMIT_CLAIM_TTL_SECONDS = 180;

function gameSubmitClaimKey(gameID) {
   return `submitlock:game:${gameID}`;
}

/**
 * The queue match a combine game was played for: the submitter's own, or, when they aren't bound to
 * one (a sub, or someone outside the lobby), the one most of the game's players are bound to.
 */
async function resolveCombineQueueContext(userId, riotMatch, gameID) {
   const own = await resolveQueueSubmissionContext(userId);
   if (own && gameBelongsToLobby(riotMatch, own)) return own;

   const puuids = (riotMatch.players ?? []).map((player) => player.puuid).filter(Boolean);
   const discordIds = await discordIdsForPuuids(puuids);
   const context = await resolveQueueContextFromPlayers(discordIds);
   if (context && gameBelongsToLobby(riotMatch, context)) {
      logger.log(`INFO`, `Combine game ${gameID} submitted by ${userId}, who isn't bound to it; matched queue match ${context.queueId} from the game's players`);
      return context;
   }

   const [status, currentQueueId] = await getRedisClient().hmget(playerKey(userId), `status`, `currentQueueId`).catch(() => []);
   const predates = own ? `; the game started before their queue match ${own.queueId} was created` : ``;
   logger.log(`WARNING`, `Combine game ${gameID} submitted by ${userId} matched no queue match (submitter status=${status ?? `none`}, currentQueueId=${currentQueueId ?? `none`}; ${discordIds.length}/${puuids.length} game players linked to Discord${predates})`);
   return null;
}

/**
 * A lobby can only be closed by a game played in it, which can't have started before the lobby was made.
 * Players were closing fresh lobbies with games from earlier ones.
 */
function gameBelongsToLobby(riotMatch, context) {
   const gameStartedAt = Number(riotMatch.matchInfo?.gameStartMillis);
   const lobbyCreatedAt = Number(context.matchData?.createdAt);
   if (!gameStartedAt || !lobbyCreatedAt) return true;
   return gameStartedAt >= lobbyCreatedAt;
}

async function discordIdsForPuuids(puuids) {
   if (!puuids.length) return [];
   const riotAccounts = await prisma.account.findMany({
      where: { providerAccountId: { in: puuids } },
      select: { userId: true },
   });
   const discordAccounts = await prisma.account.findMany({
      where: { userId: { in: riotAccounts.map((account) => account.userId) }, provider: `discord` },
      select: { providerAccountId: true },
   });
   return discordAccounts.map((account) => account.providerAccountId);
}

const NUMBERS_REACH_WINDOW_MS = 3000;

/**
 * Hand a game to the numbers processor without waiting for it to finish. Numbers only answers once the
 * game is fully processed (which can take close to a minute) and the link path doesn't use the answer,
 * so wait just long enough to catch it being unreachable or rejecting the game right away.
 * Numbers replies HTTP 200 even when it rejects a game, so the verdict comes from the body.
 * @param {{ onLateRejection?: (error: Error & { reason?: string }) => void }} options called if numbers
 *    fails or rejects the game after the player was already told it was submitted
 * @returns {Promise<{ ok: boolean, reason?: string }>} ok is false if numbers couldn't be reached or rejected the game
 */
async function sendToNumbers(game, { onLateRejection } = {}) {
   const request = submitGame({ gameId: game.id, gameType: game.type, tier: game.tier }).then((result) => {
      // game_exist means it's already recorded, which is all the submit needs
      if (result.completed || result.reason === `game_exist`) return;
      const error = new Error(result.httpOk ? `Numbers rejected game ${game.id}: ${result.reason ?? `no reason given`}` : `Numbers returned an HTTP error for game ${game.id}`);
      error.reason = result.reason ?? null;
      throw error;
   });

   let windowTimer;
   const windowElapsed = new Promise((resolve) => { windowTimer = setTimeout(resolve, NUMBERS_REACH_WINDOW_MS, `pending`); });
   const outcome = await Promise.race([request.then(() => `ok`, (error) => error), windowElapsed]);
   clearTimeout(windowTimer);

   if (outcome instanceof Error) {
      logger.log(`ERROR`, `Numbers didn't accept game ${game.id}`, outcome.stack);
      return { ok: false, reason: outcome.reason ?? undefined };
   }

   if (outcome === `pending`) {
      request.catch((error) => {
         logger.log(`ERROR`, `Numbers failed while processing game ${game.id} after the player was told it was submitted`, error.stack);
         // let it be resubmitted once whatever numbers objected to is sorted out
         getRedisClient().del(gameSubmitClaimKey(game.id)).catch(() => undefined);
         onLateRejection?.(error);
      });
   }
   return { ok: true };
}

const COMBINE_LINK_REQUIRED_MESSAGE = `Combine games must be submitted with a tracker.gg link: \`/submit url:<link>\`. The tier is filled in from your queue match.`;

async function submitFromAutoDetection(interaction, { type }) {
   if (type === GameType.COMBINE) return await interaction.editReply({ content: COMBINE_LINK_REQUIRED_MESSAGE });
   return await submitScheduledFromAutoDetection(interaction, { type });
}

/** Combine: the queue lobby defines the players. Detect the single custom they just played. */
async function submitCombineFromAutoDetection(interaction) {
   const queueContext = await resolveQueueSubmissionContext(interaction.user.id);
   if (!queueContext) {
      return await interaction.editReply({ content: `I couldn't find a finished combine match for you. If you just played one, try again in a moment, or submit with a tracker.gg link.` });
   }

   if (!queueContext.teamA.includes(interaction.user.id)) {
      return await interaction.editReply({ content: `Only players from team A can submit combine results.` });
   }

   let result;
   try {
      result = await detectMatches({ discordUserId: interaction.user.id, combinePlayers: queueContext.players });
   } catch (error) {
      logger.log(`ERROR`, `Combine detection failed`, error.stack);
      return await interaction.editReply({ content: `I couldn't reach the numbers service to detect your combine game. Please try again or submit with a tracker.gg link.` });
   }

   if (result.reason) {
      if (result.reason === `already_submitted`) return await interaction.editReply({ embeds: [buildAlreadySubmittedEmbed(result)] });
      return await interaction.editReply({ content: reasonMessage(result) });
   }

   const game = result.games[0];
   const confirm = new ButtonBuilder({ customId: `submitdetect_confirm`, label: `Submit combine game`, style: ButtonStyle.Success });
   const cancel = new ButtonBuilder({ customId: `submitdetect_cancel`, label: `Cancel`, style: ButtonStyle.Danger });
   const message = await interaction.editReply({ embeds: [buildCombineCandidateEmbed(game, queueContext.tier)], components: [new ActionRowBuilder({ components: [confirm, cancel] })] });

   const ping = await interaction.followUp({ content: `${userMention(interaction.user.id)} confirm your combine submission above.`, allowedMentions: { users: [interaction.user.id] } }).catch(() => null);

   const submissionState = {
      userId: interaction.user.id,
      gameType: GameType.COMBINE,
      tier: queueContext.tier,
      queueId: queueContext.queueId,
      pingMessageId: ping?.id ?? null,
      games: [{ game_id: game.game_id, map: game.map }],
   };
   const redis = getRedisClient();
   await redis.set(detectStateKey(message.id), JSON.stringify(submissionState), `EX`, DETECT_STATE_TTL_SECONDS);
   return message;
}

const CAP_BY_MATCH_TYPE = { BO2: 2, BO3: 3, BO5: 5 };

/** The caller's current unplayed scheduled match; the Redis lock, not this, serializes submitters. */
async function resolveCurrentMatch(discordId) {
   const player = await Player.getBy({ discordID: discordId });
   const teamId = player?.team;
   if (!teamId) return { ok: false, message: `You don't appear to be on a team, so I can't submit a scheduled match for you.` };

   const season = await ControlPanel.getSeason();
   const matches = await prisma.matches.findMany({
      where: {
         season: season,
         matchType: { in: [MatchType.BO2, MatchType.BO3, MatchType.BO5] },
         OR: [{ home: teamId }, { away: teamId }],
      },
      include: { Games: true, Home: true, Away: true },
      orderBy: { dateScheduled: `asc` },
   });

   const currentMatch = matches.find((match) => match.Games.length < (CAP_BY_MATCH_TYPE[match.matchType] ?? Infinity));
   if (!currentMatch) return { ok: false, message: `I couldn't find an unplayed scheduled match for your team.` };

   const callerTeamName = currentMatch.home === teamId ? currentMatch.Home?.name : currentMatch.Away?.name;
   return { ok: true, matchID: currentMatch.matchID, callerTeamName: callerTeamName ?? `your team` };
}

function contendedMessage(lock) {
   const submitter = lock.heldByTeamName ? `**${lock.heldByTeamName}**` : `The other team`;
   return `${submitter} is already submitting this match, so you don't need to. You're all set. (If they don't finish, either team can run \`/submit\` again later.)`;
}

/** Season/playoff: detect the games and confirm; the lock is held across the confirm step. */
async function submitScheduledFromAutoDetection(interaction, { type }) {
   const current = await resolveCurrentMatch(interaction.user.id);
   if (!current.ok) return await interaction.editReply({ content: current.message });

   let lockMatchID = current.matchID;
   let lock = await acquireMatchSubmitLock(lockMatchID, { teamName: current.callerTeamName, userId: interaction.user.id });
   if (!lock.ok) return await interaction.editReply({ content: contendedMessage(lock) });

   let result;
   try {
      result = await detectMatches({ discordUserId: interaction.user.id });
   } catch (error) {
      logger.log(`ERROR`, `Match detection failed`, error.stack);
      await releaseMatchSubmitLock(lockMatchID, lock.lockValue);
      return await interaction.editReply({ content: `I couldn't reach the numbers service to detect your match. Please try again or submit with a tracker.gg link.` });
   }

   if (result.reason) {
      await releaseMatchSubmitLock(lockMatchID, lock.lockValue);
      if (result.reason === `already_submitted`) return await interaction.editReply({ embeds: [buildAlreadySubmittedEmbed(result)] });
      return await interaction.editReply({ content: reasonMessage(result) });
   }

   // detect anchors on the lobby actually played, which differs from the caller's earliest
   // unplayed match when an earlier one was postponed; the lock must guard the detected match
   if (Number(result.scheduledMatch.matchID) !== Number(lockMatchID)) {
      await releaseMatchSubmitLock(lockMatchID, lock.lockValue);
      lockMatchID = Number(result.scheduledMatch.matchID);
      lock = await acquireMatchSubmitLock(lockMatchID, { teamName: current.callerTeamName, userId: interaction.user.id });
      if (!lock.ok) return await interaction.editReply({ content: contendedMessage(lock) });
   }

   const submittableGames = result.games.filter(isSubmittable);
   const embed = buildCandidateEmbed(result);

   const components = [];
   if (submittableGames.length) {
      const confirm = new ButtonBuilder({ customId: `submitdetect_confirm`, label: `Submit ${submittableGames.length} game(s)`, style: ButtonStyle.Success });
      const cancel = new ButtonBuilder({ customId: `submitdetect_cancel`, label: `Cancel`, style: ButtonStyle.Danger });
      components.push(new ActionRowBuilder({ components: [confirm, cancel] }));
   }

   const message = await interaction.editReply({ embeds: [embed], components });

   if (!submittableGames.length) {
      await releaseMatchSubmitLock(lockMatchID, lock.lockValue);
      return message;
   }

   const ping = await interaction.followUp({ content: `${userMention(interaction.user.id)} confirm your match submission above.`, allowedMentions: { users: [interaction.user.id] } }).catch(() => null);

   const submissionState = {
      userId: interaction.user.id,
      gameType: type,
      tier: result.scheduledMatch.tier,
      matchType: result.scheduledMatch.matchType,
      matchDay: result.scheduledMatch.matchDay,
      matchID: result.scheduledMatch.matchID,
      homeName: result.scheduledMatch.homeName,
      awayName: result.scheduledMatch.awayName,
      pingMessageId: ping?.id ?? null,
      lockMatchID: lockMatchID,
      lockValue: lock.lockValue,
      games: submittableGames.map((game) => ({ game_id: game.game_id, map: game.map })),
   };

   const redis = getRedisClient();
   await redis.set(detectStateKey(message.id), JSON.stringify(submissionState), `EX`, DETECT_STATE_TTL_SECONDS);
   await refreshMatchSubmitLock(lockMatchID, lock.lockValue);

   return message;
}
