// turns "FF | FF Player" into "FF | Player" when someone put their team tag in their riot name.
// strips every leading repeat ("FF | FF FF Player" -> "FF | Player"), null when there's nothing to do
function dedupeNickname(slug, nickname) {
	if (!slug || !nickname) return null;
	const prefix = `${slug} | `;
	if (!nickname.startsWith(prefix)) return null;

	let namePart = nickname.slice(prefix.length);
	if (!namePart.startsWith(`${slug} `)) return null;

	while (namePart.startsWith(`${slug} `)) namePart = namePart.slice(slug.length + 1);
	if (namePart.length === 0) return null;
	return prefix + namePart;
}

module.exports = { dedupeNickname };
