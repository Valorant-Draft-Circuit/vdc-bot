const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);

function buildMatchComponents(queueId) {
	const joinAttackers = new ButtonBuilder()
		.setCustomId(`queueManager_joinAttackers-${queueId}`)
		.setLabel(`Join Attackers`)
		.setStyle(ButtonStyle.Danger);

	const joinDefenders = new ButtonBuilder()
		.setCustomId(`queueManager_joinDefenders-${queueId}`)
		.setLabel(`Join Defenders`)
		.setStyle(ButtonStyle.Success);

	const submitResult = new ButtonBuilder()
		.setCustomId(`queueManager_submit-${queueId}`)
		.setLabel(`Submit Match Link`)
		.setStyle(ButtonStyle.Primary);

	return [
		new ActionRowBuilder({
			components: [joinAttackers, joinDefenders, submitResult],
		}),
	];
}

module.exports = {
	buildMatchComponents,
};
