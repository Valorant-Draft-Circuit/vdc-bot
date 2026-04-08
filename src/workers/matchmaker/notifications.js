async function mapWithConcurrency(items, concurrency, worker) {
	const limit = Math.max(1, Number(concurrency) || 1);
	const queue = Array.isArray(items) ? items.slice() : [];
	const runners = [];

	for (let i = 0; i < Math.min(limit, queue.length); i++) {
		runners.push(
			(async () => {
				while (queue.length) {
					const item = queue.shift();
					await worker(item);
				}
			})(),
		);
	}

	await Promise.all(runners);
}

async function notifyPlayersDirectly(client, payload, embedData, textChannelId, guild, scoutIds = []) {
	const channelLink = `https://discord.com/channels/${guild.id}/${textChannelId}`;
	const playerContent = `Match Found, Agent! Good luck out there. Match chat: ${channelLink}`;
	const players = Array.isArray(payload?.players) ? payload.players : [];

	await mapWithConcurrency(players, 3, async (player) => {
		const playerId = player?.id;
		if (!playerId) return;
		try {
			const user = await client.users.fetch(playerId);
			await user.send({ content: playerContent, embeds: [embedData] });
		} catch (error) {
            // Disabling this log due to noise.
			// logger.log(`WARNING`, `Failed to DM player ${playerId} about match ${payload.queueId}`);
		}
	});

	if (!Array.isArray(scoutIds) || scoutIds.length === 0) return;

	const uniqueScouts = [...new Set(scoutIds.filter(Boolean))];
	const scoutContent = `A player you've followed has found a match! Match chat: ${channelLink}`;
	await mapWithConcurrency(uniqueScouts, 3, async (scoutId) => {
		try {
			const user = await client.users.fetch(scoutId);
			await user.send({ content: scoutContent, embeds: [embedData] });
		} catch (error) {
			logger.log(`WARNING`, `Failed to DM scout ${scoutId} about match ${payload.queueId}`);
		}
	});
}

module.exports = {
	notifyPlayersDirectly,
	mapWithConcurrency,
};
