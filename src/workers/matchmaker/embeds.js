const { EmbedBuilder } = require(`discord.js`);
const { COLORS } = require(`../../../utils/enums/colors`);

function buildMatchEmbed(payload, mapInfo, showMmrTotals) {
	const safePayload = payload && typeof payload === `object` ? payload : {};
	const teamAIds = Array.isArray(safePayload.teamA) ? safePayload.teamA : [];
	const teamBIds = Array.isArray(safePayload.teamB) ? safePayload.teamB : [];
	const playersById = buildPlayersByIdMap(safePayload.players);
	// Current payload convention: teamB maps to Attackers and teamA maps to Defenders.
	const attackers = formatTeamRoster(teamBIds, playersById);
	const defenders = formatTeamRoster(teamAIds, playersById);

	const teamMmr = safePayload.teamMmr || {};
	const hasMmr =
		showMmrTotals &&
		typeof teamMmr.teamA === `number` &&
		typeof teamMmr.teamB === `number`;
	const defendersMmr = hasMmr ? Math.round(teamMmr.teamA) : 0;
	const attackersMmr = hasMmr ? Math.round(teamMmr.teamB) : 0;
	const diff = hasMmr ? Math.abs(attackersMmr - defendersMmr) : 0;

	const embed = new EmbedBuilder()
		.setTitle(`MATCH FOUND!`)
		.setAuthor({ name: `VDC Queue Manager` })
		.setDescription(
			`**Tier**: ${safePayload.tier ?? `Unknown`}\n` +
				`**Queue ID**: ${safePayload.queueId ?? `Unknown`}\n` +
				`**Map**: ${mapInfo?.name ?? `TBD`}\n` +
				`**Relaxed**: ${safePayload.relaxed ? `Yes` : `No`}`,
		)
		.addFields(
			{ name: `Attackers Roster`, value: attackers || `TBD`, inline: true },
			{ name: `Defenders Roster`, value: defenders || `TBD`, inline: true },
		)
		.setColor(COLORS[safePayload.tier] || 0xDE3845)
		.setFooter({ text: `If you'd still like to change the map, feel free to do so!` });

	if (hasMmr) {
		embed.addFields({
			name: `MMR Totals`,
			value: `Attackers: **${attackersMmr}**\nDefenders: **${defendersMmr}**\nΔ: **${diff}**`,
			inline: false,
		});
	}

	if (mapInfo?.image) {
		embed.setImage(mapInfo.image);
	}

	return embed;
}

function buildPlayersByIdMap(players) {
	const map = new Map();
	if (!Array.isArray(players)) return map;

	for (const player of players) {
		const id = player?.id ? String(player.id) : null;
		if (!id) continue;

		const username =
			player?.username ||
			player?.discordUsername ||
			player?.displayName ||
			player?.name ||
			null;

		if (username) {
			map.set(id, String(username));
		}
	}

	return map;
}

function formatTeamRoster(ids, playersById) {
	if (!Array.isArray(ids) || ids.length === 0) return ``;

	return ids
		.map((id) => {
			const sid = String(id);
			const mention = `<@${sid}>`;
			const name = playersById.get(sid);
			if (!name) return `${mention} (${sid})`;
			return `${mention} (${name})`;
		})
		.join(`\n`);
}

function buildPriorityEmbed(payload) {
	const players = Array.isArray(payload?.players) ? payload.players.slice() : [];
	if (players.length === 0) {
		return new EmbedBuilder().setTitle(`Agent Lock Order`).setDescription(`No players found`).setColor(0x5865F2);
	}

	const order = [`DE`, `FA`, `RFA`, `SIGNED`];
	const bucketIndex = (bucket) => {
		const i = order.indexOf(String(bucket || ``).toUpperCase());
		return i === -1 ? 999 : i;
	};

	players.sort((a, b) => {
		const aCompleted = !!a.completed;
		const bCompleted = !!b.completed;
		const aw = bucketIndex(a.bucket) + (aCompleted ? 3 : 0);
		const bw = bucketIndex(b.bucket) + (bCompleted ? 3 : 0);
		if (aw !== bw) return aw - bw;

		const aj = typeof a.joinedAt === `number` ? a.joinedAt : 0;
		const bj = typeof b.joinedAt === `number` ? b.joinedAt : 0;
		if (aj !== bj) return aj - bj;

		return String(a.id).localeCompare(String(b.id));
	});

	const lines = players.map((p) => {
		const mention = `<@${p.id}>`;
		const bucket = String(p.bucket || `?`);
		const isCompleted = p.completed ? `, Requirements Fulfilled` : ``;
		const groupIdx = bucketIndex(p.bucket) + (p.completed ? 3 : 0);
		const displayNumber = groupIdx === 999 ? `?` : String(groupIdx + 1);
		const dot = `.\u200B `;
		return `${displayNumber}${dot}${mention} - ${bucket}${isCompleted}`;
	});

	return new EmbedBuilder()
		.setTitle(`Agent Lock Order`)
		.setDescription(lines.join(`\n`))
		.setFooter({ text: `The order listed is the order that should be followed when locking in. If you see anyone ignoring the order, please open a ticket.` });
}

module.exports = {
	buildMatchEmbed,
	buildPriorityEmbed,
};
