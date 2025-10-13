const { MessageFlags } = require(`discord.js`);
const { getRedisClient, runLua } = require(`../../../core/redis`);

async function leaveQueue(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	try {
		const response = await runLua(`leave`, {
			keys: buildLeaveKeys(interaction.user.id),
			args: [interaction.user.id, String(Date.now())],
		});
		const payload = parseLuaJson(response);

		if (!payload.ok) {
			return interaction.editReply({
				content: mapLeaveErrorToMessage(payload),
			});
		}

		return interaction.editReply({
			content: `You have been removed from the ${payload.tier ?? `queue`} queue.`,
		});
	} catch (error) {
		logger.log(`ERROR`, `Queue leave failed`, error);
		return interaction.editReply({
			content: `Unable to remove you from the queue right now. Please contact an admin if this persists.`,
		});
	}
}

function buildLeaveKeys(userId) {
	return [
		`vdc:player:${userId}`,
		`vdc:events`,
		`vdc:league_state`,
	];
}

function mapLeaveErrorToMessage(payload) {
	const code = payload?.error ?? `UNKNOWN`;
	switch (code) {
		case `NOT_QUEUED`:
			return `You're not currently queued.`;
		case `IN_MATCH`:
			return `You can't leave the queue because you're in an active match.`;
		default:
			return `Could not remove you from the queue (${code}).`;
	}
}

function parseLuaJson(payload) {
	if (payload == null) return {};
	if (typeof payload === `string`) {
		try {
			return JSON.parse(payload);
		} catch (error) {
			logger.log(`ERROR`, `Failed to parse Lua script response`, error);
			return {};
		}
	}
	return payload;
}

module.exports = {
	leaveQueue,
};
