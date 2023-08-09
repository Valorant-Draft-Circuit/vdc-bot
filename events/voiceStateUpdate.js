module.exports = {

	/**
	 * Emitted whenever a member changes voice state - e.g. joins/leaves a channel, mutes/unmutes.
	 * @type {Event}
	 * @references
	 * @djs https://discord.js.org/#/docs/discord.js/main/class/Client?scrollTo=e-voiceStateUpdate
	 * @api https://discord.com/developers/docs/topics/gateway-events#voice-state-update
	 */

	name: `voiceStateUpdate`,
	once: false,

	async execute(client, oldState, newState) {
		/** Placeholder - voiceStateUpdates need special logic. Relavant functions are preserved below, changes required */
		return;
	}
};

/**
 * Function to create a new voice channel
 * @param {Client} client active BotClient instance
 * @param {Object} voiceState voiceState object
 */
async function voiceCreate(client, voiceState) {

	// get array of voiceChannels
	const voiceChannelArray = voiceState.guild.channels.cache
		.filter(c => c.name.includes(`🔊│Comm`))
		.map(c => c.name);

	for (let i = 1; i < voiceChannelArray.length + 2; i++) {
		if (voiceChannelArray.includes(`🔊│Comm ` + i)) continue;

		const newVoiceChannel = await voiceState.guild.channels.create(`🔊│Comm ${i}`, {
			type: 'GUILD_VOICE',
			parent: voiceState.channel.parentId,
			position: voiceState.channel.rawPosition + i,
			bitrate: 64000,
		});

		await voiceState.channel.members.map(m => m.voice.setChannel(newVoiceChannel.id));
		return await client.logger.console({
            level: `INFO`,
            title: `Event - voiceStateUpdate`,
            message: [`${newVoiceChannel.name} was created`]
        });
	}
}

/**
 * Function to remove a voice channel
 * @param {Client} client active BotClient instance
 * @param {Object} voiceChannel voiceState object
 */
async function voiceDelete(client, voiceChannel) {
	await client.logger.console(`INFO`, `Event - voiceStateUpdate`, `${voiceChannel.channel.name} was removed`);
	await voiceChannel.channel.delete();
	return;
}