const { MessageFlags, userMention, channelMention } = require(`discord.js`);
const { getRedisClient } = require(`../../core/redis`);
const { getQueueMatchContext } = require(`../../core/queue/matchLifecycle`);
const { matchKey } = require(`../../helpers/queue/queueKeys`);

const PING_COOLDOWN_SECONDS = 60;

const BUTTON_LABELS = {
	joinAttackers: `Join Attackers VC`,
	joinDefenders: `Join Defenders VC`,
	submit: `Submit Match Link`,
};

module.exports = {
	id: `queueManagerManager`,

	/**
	 * @param {import('discord.js').ButtonInteraction} interaction
	 * @param {string} action
	 */
	async execute(interaction, action = ``) {
		const separatorIndex = action.indexOf(`-`);
		const command = separatorIndex === -1 ? action : action.slice(0, separatorIndex);
		const queueId = separatorIndex === -1 ? `` : action.slice(separatorIndex + 1);
		const label = BUTTON_LABELS[command] ?? `Queue Action`;

		if (!queueId) {
			return interaction.reply({
				content: `Missing match information for this action.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		if (command === `submit`) {
			return interaction.reply({
				content: `Use /submit to submit your Tracker link. Combine queue matches are auto-completed from that command.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		if (command === `pingMissing`) {
			return pingPlayersNotInVoice(interaction, queueId);
		}

		try {
			const inviteUrl = await createVoiceInvite(interaction, queueId, command);
			if (!inviteUrl) {
				return interaction.reply({
					content: `Unable to locate an appropriate voice channel for this match.`,
					flags: MessageFlags.Ephemeral,
				});
			}

			return interaction.reply({
				content: `${label} ready! Use this invite (expires in 30 seconds): ${inviteUrl}`,
				flags: MessageFlags.Ephemeral,
			});
		} catch (error) {
			logger.log(`ERROR`, `Failed to create queue invite`, error);
			return interaction.reply({
				content: `We couldn't generate an invite right now. Please try again shortly.`,
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};

/** Ping the lobby's players who aren't in its voice channels, each pointed at their own team's channel. */
async function pingPlayersNotInVoice(interaction, queueId) {
	const queueContext = await getQueueMatchContext(queueId);
	if (!queueContext || queueContext.matchData.status === `completed`) {
		return interaction.reply({ content: `This match is already over.`, flags: MessageFlags.Ephemeral });
	}
	if (!queueContext.players.includes(interaction.user.id)) {
		return interaction.reply({ content: `Only players in this match can ping the lobby.`, flags: MessageFlags.Ephemeral });
	}

	let descriptor = {};
	try {
		descriptor = JSON.parse(queueContext.matchData.channelIdsJSON || `{}`);
	} catch {
		descriptor = {};
	}
	const voice = descriptor.voiceChannelIds ?? {};
	const lobbyVoiceIds = new Set([voice.teamA, voice.teamB].filter(Boolean));
	if (lobbyVoiceIds.size === 0) {
		return interaction.reply({ content: `This match has no voice channels to check.`, flags: MessageFlags.Ephemeral });
	}

	const teamChannel = new Map([
		...queueContext.teamA.map((id) => [id, voice.teamA]),
		...queueContext.teamB.map((id) => [id, voice.teamB]),
	]);
	const missing = queueContext.players.filter((id) => !lobbyVoiceIds.has(interaction.guild.voiceStates.cache.get(id)?.channelId));
	if (missing.length === 0) {
		return interaction.reply({ content: `Everyone is already in voice.`, flags: MessageFlags.Ephemeral });
	}

	// the cooldown key stays out of vdc:match:*, which the lobby scans expect to hold only hashes
	const cooldown = await getRedisClient().set(`vdc:pingcooldown:${queueId}`, interaction.user.id, `EX`, PING_COOLDOWN_SECONDS, `NX`);
	if (cooldown !== `OK`) {
		return interaction.reply({ content: `This lobby was pinged recently. Try again in a minute.`, flags: MessageFlags.Ephemeral });
	}

	const lines = missing.map((id) => `${userMention(id)} ${teamChannel.get(id) ? `→ ${channelMention(teamChannel.get(id))}` : ``}`.trim());
	return interaction.reply({
		content: `${interaction.user} is waiting on you in voice:\n${lines.join(`\n`)}`,
		allowedMentions: { users: missing },
	});
}

async function createVoiceInvite(interaction, queueId, command) {
	const redis = getRedisClient();
	const descriptorRaw = await redis.hget(matchKey(queueId), `channelIdsJSON`);
	if (!descriptorRaw) return null;

	let descriptor;
	try {
		descriptor = JSON.parse(descriptorRaw);
	} catch {
		return null;
	}

	const targetChannelId = selectChannelId(command, descriptor);
	if (!targetChannelId) return null;

	const channel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);
	if (!channel || typeof channel.createInvite !== `function`) return null;

	const invite = await channel.createInvite({
		maxAge: 30,
		maxUses: 1,
		unique: true,
		reason: `Queue quick join for match ${queueId}`,
	});

	return invite?.url ?? null;
}

function selectChannelId(command, descriptor) {
	if (!descriptor || typeof descriptor !== `object`) return null;

	const voice = descriptor.voiceChannelIds ?? {};

	switch (command) {
		case `joinAttackers`:
			return voice.teamB;
		case `joinDefenders`:
			return voice.teamA;
		default:
			return null;
	}
}