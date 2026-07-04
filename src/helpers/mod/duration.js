const UNIT_MILLISECONDS = {
	s: 1000,
	m: 60 * 1000,
	h: 60 * 60 * 1000,
	d: 24 * 60 * 60 * 1000,
	w: 7 * 24 * 60 * 60 * 1000,
};

/** Parse a duration string into an expiry Date (null = permanent).
 * Any positive amount with a unit works: seconds, minutes, hours, days, weeks.
 * `season` / `4seasons` (bans only) have no expiry date - the reconciliation
 * worker lifts them once the ControlPanel season rolls past the ban's last
 * covered season. The label round-trips through the confirmation embed.
 * @param {string} input e.g. "45s", "30m", "12h", "32d", "2w", "perm", "season"
 * @returns {{ expires: Date | null, label: string }}
 * @throws {Error} on unparseable input
 */
function parseDuration(input) {
	const normalized = String(input).trim().toLowerCase();
	if (normalized === `perm` || normalized === `permanent`) {
		return { expires: null, label: `permanent` };
	}
	const seasonMatch = normalized.match(/^(\d+)?seasons?$/);
	if (seasonMatch) {
		const seasons = Number(seasonMatch[1] ?? 1);
		if (seasons <= 0) throw new Error(`Season count must be positive.`);
		return { expires: null, label: seasons === 1 ? `season` : `${seasons}seasons`, seasons };
	}

	const match = normalized.match(/^(\d+)([smhdw])$/);
	if (!match) throw new Error(`Invalid duration \`${input}\`. Use a number + unit like \`45s\`, \`30m\`, \`12h\`, \`32d\`, \`2w\`, or \`perm\`.`);

	const amount = Number(match[1]);
	const unit = match[2];
	if (amount <= 0) throw new Error(`Duration must be positive.`);

	const expires = new Date(Date.now() + amount * UNIT_MILLISECONDS[unit]);
	return { expires, label: normalized };
}

module.exports = { parseDuration };
