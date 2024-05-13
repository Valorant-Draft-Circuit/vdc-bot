const { generateSeasonThumbnail, generatePlayoffsImages } = require("../subcommands/media");

module.exports = {
	name: `media`,

	async execute(interaction) {
		// defer as early as possible
		await interaction.deferReply();

		const { _subcommand, _hoistedOptions } = interaction.options;

		/*	Programmer Notes:
		 * 		You'll notice that the switch case statements below
		 * 		include cruly braces, when JavaScript doesn't require
		 * 		them. This is because without them, the entire switch/case
		 * 		block is treated as a single block instead of each case
		 * 		statement being treated as a unique block.
		 * 
		 * 		This is required because the `_hoistedOptions` can be
		 * 		different for each subcommand and the order of them are
		 * 		not the same, so the first input may be "player" for one
		 * 		command and something else for another command.
		 */
		console.log(_subcommand)
		switch (_subcommand) {
			case `generate-season-thumbnail`: {
				// Player whose contract to cut
				const homeTeam = _hoistedOptions[0].value;
				const awayTeam = _hoistedOptions[1].value;
				const day = _hoistedOptions[2].value;
				const time = _hoistedOptions[3] ? _hoistedOptions[3].value : `9:00 EST / 6:00 PST`;

				console.log(homeTeam, awayTeam, day, time);
				return generateSeasonThumbnail(interaction, homeTeam, awayTeam, day, time)
			}
			case `generate-playoffs-images`: {
				// Player whose contract to cut
				const homeTeam = _hoistedOptions[0].value;
				const awayTeam = _hoistedOptions[1].value;
				const imagetype = _hoistedOptions[2].value;
				const matchtype = _hoistedOptions[3].value;
				const time = _hoistedOptions[4] ? _hoistedOptions[3].value : `7:00 EST / 4:00 PST`;

				console.log(homeTeam, awayTeam, time, imagetype, matchtype);
				return generatePlayoffsImages(interaction, {
					homeName: homeTeam,
					awayName: awayTeam,
					resolution: `1080P`,
					time: time,
					type: imagetype,
					style: matchtype,
				})
			}
			default:
				return interaction.editReply(`That's not a valid subcommand or this command is a work in progress!`);
		}
	},
};
