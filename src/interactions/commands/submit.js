const { GameType, MatchType } = require(`@prisma/client`);
const { Games, ControlPanel, Player } = require(`../../../prisma`);
const { prisma } = require(`../../../prisma/prismadb`);
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const {
   resolveQueueSubmissionContext,
   finalizeQueueCombineSubmission,
} = require(`../../core/queue/matchLifecycle`);
const { detectMatches } = require(`../../helpers/numbers`);
const { getRedisClient } = require(`../../core/redis`);
const {
   DETECT_STATE_TTL_SECONDS,
   reasonMessage,
   buildAlreadySubmittedEmbed,
   detectStateKey,
   buildCandidateEmbed,
   buildCombineCandidateEmbed,
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
      else return await interaction.editReply({ content: `The league state enum in the control panel is set incorrectly. Please open a tech ticket.` });

      if (url) return await submitFromLink(interaction, { url, submittedTier, type });
      return await submitFromAutoDetection(interaction, { type });
   }
};

/** Legacy path: submit a single game from a tracker.gg link. */
async function submitFromLink(interaction, { url, submittedTier, type }) {
   if (!validMatchRegex.test(url)) return await interaction.editReply({ content: `That doesn't look like a valid match URL! Please try again or open a tech ticket!` });

   const gameID = url.replace(`https://tracker.gg/valorant/match/`, ``);
   const exists = await Games.exists({ id: gameID });
   if (exists) return await interaction.editReply({ content: `Looks like this match was already submitted!` });

   const response = await fetch(`${riotMatchesV1}/${gameID}?api_key=${process.env.VDC_API_KEY}`);
   const data = await response.json();
   if (data.matchInfo === undefined) return await interaction.editReply({ content: `There was a problem checking Riot's servers! Please try again or open a tech ticket!` });
   if (data.matchInfo.provisioningFlowId !== `CustomGame`) return await interaction.editReply({ content: `The match you submitted ([\`${gameID}\`](${url})) doesn't look like a custom game! Please double check your match and try again` });

   const queueContext = type === GameType.COMBINE
      ? await resolveQueueSubmissionContext(interaction.user.id)
      : null;
   const tier = queueContext?.tier ?? submittedTier;

   if (!tier) return await interaction.editReply({ content: `Please include the \`tier\` option when submitting with a link.` });

   // TODO: this name is misleading. it doesnt save anything to the DB it just calls the numbers processor to submit the game.
   await Games.saveMatch({ id: gameID, tier: tier, type: type });

   let combineFinalized = false;
   if (type === GameType.COMBINE && queueContext) {
      combineFinalized = await finalizeQueueCombineSubmission({
			guild: interaction.guild,
			userId: interaction.user.id,
      queueContext,
      gameID,
      url,
      });
   }

   const embed = new EmbedBuilder({
      author: { name: `VDC Match Submission` },
      description: `Your match was successfully submitted!`,
      thumbnail: { url: iconURL },
      color: 0xE92929,
      fields: [
         {
            name: `​`,
            value: `Tier:\nType:\nMatch ID:${combineFinalized ? `\nQueue:` : ``}`,
            inline: true
         },
         {
            name: `​`,
            value: `${tier}\n${type}\n[\`${gameID}\`](${url})${combineFinalized ? `\nMarked for deletion + players unlocked` : ``}`,
            inline: true
         }
      ],
      footer: { text: `Valorant Draft Circuit — Match Result Submissions` }
   });

   logger.matchdrain(`<t:${Math.round(Date.now() / 1000)}:d> <t:${Math.round(Date.now() / 1000)}:T> **Match submission** - __Tier__: \`${tier}\`, __Type__: \`${type}\`, __Match ID__: [\`${gameID}\`](${url})`);
   logger.log(`VERBOSE`, `Match submission - Tier: \`${tier}\`, Type: \`${type}\`, Match ID: [\`${gameID}\`](${url})`);
   return await interaction.editReply({ embeds: [embed] });
}

/** No link: dispatch to combine or scheduled auto detection. */
async function submitFromAutoDetection(interaction, { type }) {
   if (type === GameType.COMBINE) return await submitCombineFromAutoDetection(interaction);
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

   const submissionState = {
      userId: interaction.user.id,
      gameType: GameType.COMBINE,
      tier: queueContext.tier,
      queueId: queueContext.queueId,
      games: [{ game_id: game.game_id, map: game.map }],
   };
   const redis = getRedisClient();
   await redis.set(detectStateKey(message.id), JSON.stringify(submissionState), `EX`, DETECT_STATE_TTL_SECONDS);
   return message;
}

const CAP_BY_MATCH_TYPE = { BO2: 2, BO3: 3, BO5: 5 };

/** Only the home team of the caller's current unplayed scheduled match may submit it. Checked
 * bot-side so away-team players never hit the numbers service. */
async function resolveHomeTeamGate(discordId) {
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
      include: { Games: true },
      orderBy: { dateScheduled: `asc` },
   });

   const currentMatch = matches.find((match) => match.Games.length < (CAP_BY_MATCH_TYPE[match.matchType] ?? Infinity));
   if (!currentMatch) return { ok: false, message: `I couldn't find an unplayed scheduled match for your team.` };
   if (currentMatch.home !== teamId) return { ok: false, message: `Only the home team submits match results. Ask a home team player to run \`/submit\`.` };

   return { ok: true };
}

/** Season/playoff: detect the scheduled match's games and confirm before submitting. */
async function submitScheduledFromAutoDetection(interaction, { type }) {
   const gate = await resolveHomeTeamGate(interaction.user.id);
   if (!gate.ok) return await interaction.editReply({ content: gate.message });

   let result;
   try {
      result = await detectMatches({ discordUserId: interaction.user.id });
   } catch (error) {
      logger.log(`ERROR`, `Match detection failed`, error.stack);
      return await interaction.editReply({ content: `I couldn't reach the numbers service to detect your match. Please try again or submit with a tracker.gg link.` });
   }

   if (result.reason) {
      if (result.reason === `already_submitted`) return await interaction.editReply({ embeds: [buildAlreadySubmittedEmbed(result)] });
      return await interaction.editReply({ content: reasonMessage(result) });
   }

   const recommendedGames = result.games.filter((game) => game.recommended);
   const embed = buildCandidateEmbed(result);

   const components = [];
   if (recommendedGames.length) {
      const confirm = new ButtonBuilder({ customId: `submitdetect_confirm`, label: `Submit ${recommendedGames.length} game(s)`, style: ButtonStyle.Success });
      const cancel = new ButtonBuilder({ customId: `submitdetect_cancel`, label: `Cancel`, style: ButtonStyle.Danger });
      components.push(new ActionRowBuilder({ components: [confirm, cancel] }));
   }

   const message = await interaction.editReply({ embeds: [embed], components });

   if (!recommendedGames.length) return message;

   const submissionState = {
      userId: interaction.user.id,
      gameType: type,
      tier: result.scheduledMatch.tier,
      matchType: result.scheduledMatch.matchType,
      matchDay: result.scheduledMatch.matchDay,
      matchID: result.scheduledMatch.matchID,
      homeName: result.scheduledMatch.homeName,
      awayName: result.scheduledMatch.awayName,
      games: recommendedGames.map((game) => ({ game_id: game.game_id, map: game.map })),
   };

   const redis = getRedisClient();
   await redis.set(detectStateKey(message.id), JSON.stringify(submissionState), `EX`, DETECT_STATE_TTL_SECONDS);

   return message;
}
