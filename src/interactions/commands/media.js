const { generateSeasonThumbnail, generatePlayoffsImages, statsCsv } = require("../subcommands/media");

module.exports = {
	name: `media`,

	async execute(interaction) {
		// defer as early as possible
		await interaction.deferReply();

		const subcommand = interaction.options.getSubcommand();

		/*	Programmer Notes:
		 * 		You'll notice that the switch case statements below
		 * 		include cruly braces, when JavaScript doesn't require
		 * 		them. This is because without them, the entire switch/case
		 * 		block is treated as a single block instead of each case
		 * 		statement being treated as a unique block.
		 * 
		 * 		This is required because each case declares its own
		 * 		consts and several share a name (e.g. `homeTeam`), which
		 * 		would collide if every case shared the switch's single
		 * 		block.
		 */
		switch (subcommand) {
			case `generate-season-thumbnail`: {
				// Player whose contract to cut
				const homeTeam = interaction.options.getString(`home-team`);
				const awayTeam = interaction.options.getString(`away-team`);
				const day = interaction.options.getNumber(`day`);
				const time = interaction.options.getString(`time`) ?? `9:00 EST / 6:00 PST`;

				return generateSeasonThumbnail(interaction, homeTeam, awayTeam, day, time)
			}
			case `generate-playoffs-images`: {
				// Player whose contract to cut
				const homeTeam = interaction.options.getString(`home-team`);
				const awayTeam = interaction.options.getString(`away-team`);
				const imagetype = interaction.options.getString(`image-type`);
				const matchtype = interaction.options.getString(`match-type`);
				const time = interaction.options.getString(`time`) ?? `7:00 EST / 4:00 PST`;

				return generatePlayoffsImages(interaction, {
					homeName: homeTeam,
					awayName: awayTeam,
					resolution: `1080P`,
					time: time,
					type: imagetype,
					style: matchtype,
				})
			}
			case `stats-csv`: {
				const gameType = interaction.options.getString(`match-type`);
				return statsCsv(interaction, {
					gameType: gameType,
				});
			}
			default:
				return interaction.editReply(`That's not a valid subcommand or this command is a work in progress!`);
		}
	},
};
