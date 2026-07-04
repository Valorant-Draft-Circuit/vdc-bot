const UNIT_MILLISECONDS = {
	m: 60 * 1000,
	h: 60 * 60 * 1000,
	d: 24 * 60 * 60 * 1000,
	w: 7 * 24 * 60 * 60 * 1000,
};

/** Parse a duration string into an expiry Date (null = permanent).
 * @param {string} input e.g. "30m", "12h", "7d", "2w", "perm"
 * @returns {{ expires: Date | null, label: string }}
 * @throws {Error} on unparseable input
 */
function parseDuration(input) {
	const normalized = String(input).trim().toLowerCase();
	if (normalized === `perm` || normalized === `permanent`) {
		return { expires: null, label: `permanent` };
	}

	const match = normalized.match(/^(\d+)([mhdw])$/);
	if (!match) throw new Error(`Invalid duration \`${input}\`. Use forms like \`30m\`, \`12h\`, \`7d\`, \`2w\`, or \`perm\`.`);

	const amount = Number(match[1]);
	const unit = match[2];
	if (amount <= 0) throw new Error(`Duration must be positive.`);

	const expires = new Date(Date.now() + amount * UNIT_MILLISECONDS[unit]);
	return { expires, label: normalized };
}

module.exports = { parseDuration };
