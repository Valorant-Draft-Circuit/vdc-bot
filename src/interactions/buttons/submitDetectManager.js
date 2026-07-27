const { EmbedBuilder, MessageFlags } = require(`discord.js`);
const { GameType } = require(`@prisma/client`);
const { getRedisClient } = require(`../../core/redis`);
const { submitGame } = require(`../../helpers/numbers`);
const { detectStateKey, iconURL, formatMatchContext } = require(`../../helpers/submitDetect`);
const { getQueueMatchContext, finalizeQueueCombineSubmission } = require(`../../core/queue/matchLifecycle`);

module.exports = {
	id: `submitdetectManager`,

	/**
	 * @param {import('discord.js').ButtonInteraction} interaction
	 * @param {string} action `confirm` or `cancel`
	 */
	async execute(interaction, action = ``) {
		const redis = getRedisClient();
		const stateKey = detectStateKey(interaction.message.id);
		const rawState = await redis.get(stateKey);

		if (!rawState) {
			return interaction.reply({ content: `This submission expired. Please run \`/submit\` again.`, flags: MessageFlags.Ephemeral });
		}

		const state = JSON.parse(rawState);
		if (interaction.user.id !== state.userId) {
			return interaction.reply({ content: `Only the person who ran \`/submit\` can respond to this.`, flags: MessageFlags.Ephemeral });
		}

		const title = state.gameType === GameType.COMBINE ? `Combine Match` : `${state.homeName} vs ${state.awayName}`;
		const context = formatMatchContext(state);

		if (action === `cancel`) {
			await redis.del(stateKey);
			const cancelled = new EmbedBuilder({
				author: { name: `VDC Match Submission` },
				title: title,
				description: `Submission cancelled. Nothing was sent.`,
				color: 0x808080,
				footer: { text: `Valorant Draft Circuit — Match Result Submissions` },
			});
			return interaction.update({ embeds: [cancelled], components: [] });
		}

		// Immediately acknowledge: drop the buttons and show a processing state so the user sees
		// their click landed while the games submit (which can take a moment).
		const processing = new EmbedBuilder({
			author: { name: `VDC Match Submission` },
			title: title,
			description: [context, ``, `Submitting **${state.games.length}** game(s)…`].filter((line) => line !== undefined).join(`\n`),
			thumbnail: { url: iconURL },
			color: 0x5865F2,
			footer: { text: `Valorant Draft Circuit — Match Result Submissions` },
		});
		await interaction.update({ embeds: [processing], components: [] });
		await redis.del(stateKey);

		const submitted = [];
		const failed = [];
		for (const game of state.games) {
			try {
				const response = await submitGame({ gameId: game.game_id, gameType: state.gameType, tier: state.tier });
				if (response.ok) submitted.push(game);
				else failed.push(game);
			} catch (error) {
				logger.log(`ERROR`, `Auto-submit failed for game ${game.game_id}`, error.stack);
				failed.push(game);
			}
		}

		for (const game of submitted) {
			logger.matchdrain(`<t:${Math.round(Date.now() / 1000)}:d> <t:${Math.round(Date.now() / 1000)}:T> **Match submission (auto)** - __Tier__: \`${state.tier}\`, __Type__: \`${state.gameType}\`, __Match ID__: \`${game.game_id}\``);
		}

		if (state.gameType === GameType.COMBINE && submitted.length) {
			try {
				const queueContext = await getQueueMatchContext(state.queueId);
				if (queueContext) {
					const gameID = submitted[0].game_id;
					await finalizeQueueCombineSubmission({
						guild: interaction.guild,
						userId: interaction.user.id,
						queueContext,
						gameID,
						url: `https://tracker.gg/valorant/match/${gameID}`,
					});
				}
			} catch (error) {
				logger.log(`ERROR`, `Combine finalize failed for queue ${state.queueId}`, error.stack);
			}
		}

		const lines = [];
		if (submitted.length) lines.push(`Submitted **${submitted.length}** game(s):`);
		for (const game of submitted) lines.push(`✅ ${game.map ?? `Unknown map`} · \`${game.game_id}\``);
		for (const game of failed) lines.push(`❌ ${game.map ?? `Unknown map`} · \`${game.game_id}\` (failed, try a link)`);

		const body = lines.join(`\n`) || `Nothing was submitted.`;
		const done = new EmbedBuilder({
			author: { name: `VDC Match Submission` },
			title: title,
			description: context ? `${context}\n\n${body}` : body,
			thumbnail: { url: iconURL },
			color: failed.length ? 0xE9A129 : 0xE92929,
			footer: { text: `Valorant Draft Circuit — Match Result Submissions` },
		});

		return interaction.editReply({ embeds: [done], components: [] });
	},
};
