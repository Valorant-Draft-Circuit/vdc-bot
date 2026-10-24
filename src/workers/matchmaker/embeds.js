const { EmbedBuilder, userMention } = require(`discord.js`);
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
			const mention = userMention(sid);
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

	// players who completed their requirements lock after every bucket, matching how the matchmaker picks;
	// offsetting by 3 instead of the bucket count put completed DE players level with SIGNED
	const groupIndex = (player) => bucketIndex(player.bucket) + (player.completed ? order.length : 0);

	players.sort((a, b) => {
		const aw = groupIndex(a);
		const bw = groupIndex(b);
		if (aw !== bw) return aw - bw;

		const aj = typeof a.joinedAt === `number` ? a.joinedAt : 0;
		const bj = typeof b.joinedAt === `number` ? b.joinedAt : 0;
		if (aj !== bj) return aj - bj;

		return String(a.id).localeCompare(String(b.id));
	});

	// one bold header per priority, numbered without gaps, with that priority's players listed under it
	const lines = [];
	let currentGroup = null;
	let priority = 0;
	for (const p of players) {
		const group = groupIndex(p);
		if (group !== currentGroup) {
			currentGroup = group;
			priority += 1;
			const fulfilled = p.completed ? ` · Requirements Fulfilled` : ``;
			lines.push(`**${ordinal(priority)} Priority · ${String(p.bucket || `?`)}${fulfilled}**`);
		}
		lines.push(userMention(p.id));
	}

	return new EmbedBuilder()
		.setTitle(`Agent Lock Order`)
		.setDescription(lines.join(`\n`))
		.setFooter({ text: `Lock in by priority: 1st priority first, then 2nd, and so on. Players with the same priority can lock in any order. If you see anyone ignoring the order, please open a ticket.` });
}

function ordinal(n) {
	if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
	return `${n}${{ 1: `st`, 2: `nd`, 3: `rd` }[n % 10] ?? `th`}`;
}

module.exports = {
	buildMatchEmbed,
	buildPriorityEmbed,
};
