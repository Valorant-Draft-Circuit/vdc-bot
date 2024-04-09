const { cut, sign, draftSign, renew, updateTier, sub, unsub, ir, swap, retire, } = require(`../subcommands/transactions`);


const teamMMRAllowance = {
	prospect: 386,
	apprentice: 538,
	expert: 716,
	mythic: 948,
}; // max MMR allowance for teams to "spend" on players
const sum = (array) => array.reduce((s, v) => (s += v == null ? 0 : v), 0);

module.exports = {
	name: `transactions`,

	async execute(interaction) {
		// defer as early as possible
		await interaction.deferReply();

		const { _subcommand, _hoistedOptions } = interaction.options;
		switch (_subcommand) {
			case `cut`:
				// Player to cut
				const player = _hoistedOptions[0];
				return cut.cut(interaction, player);

			// case `sign`:
			// 	sign.sign(interaction, _hoistedOptions[0], _hoistedOptions[1].value);
			// 	break;
			// case `draft-sign`:
			// 	draftSign(
			// 		interaction,
			// 		_hoistedOptions[0].value,
			// 		_hoistedOptions[1].value,
			// 		_hoistedOptions[2].member,
			// 		_hoistedOptions[3].value
			// 	);
			// 	break;
			// case `update-tier`:
			// 	updateTier.updateTier(
			// 		interaction,
			// 		_hoistedOptions[0].member,
			// 		_hoistedOptions[1].value
			// 	);
			// 	break;
			// case `renew`:
			// 	renew.renew(interaction, _hoistedOptions[0], _hoistedOptions[1].value);
			// 	break;
			// case `sub`:
			// 	sub.sub(
			// 		interaction,
			// 		_hoistedOptions[0].member,
			// 		_hoistedOptions[1].member
			// 	);
			// 	break;
			// case `unsub`:
			// 	unsub.unsub(interaction, _hoistedOptions[0].member);
			// 	break;
			// case `ir`:
			// 	ir.ir(interaction, _hoistedOptions[0].member);
			// 	break;
			// case `swap`:
			// 	swap.swap(
			// 		interaction,
			// 		_hoistedOptions[0].member,
			// 		_hoistedOptions[1].member
			// 	);
			// 	break;
			// case `retire`:
			// 	retire.retire(interaction, _hoistedOptions[0].member);
			// 	break;
			default:
				return interaction.reply({ content: `That's not a valid subcommand or this command is a work in progress!` });
		}
	},
};
