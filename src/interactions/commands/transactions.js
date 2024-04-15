"use strict";

const { cut, sign, draftSign, renew, updateTier, sub, unsub, ir, retire, } = require(`../subcommands/transactions`);


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
		switch (_subcommand) {
			case `cut`: {
				// Player whose contract to cut
				const player = _hoistedOptions[0];
				return cut.cut(interaction, player);
			}

			case `sign`: {
				// Player to sign & team to sign to
				const player = _hoistedOptions[0];
				const team = _hoistedOptions[1].value;
				return sign.sign(interaction, player, team);
			}
			// case `draft-sign`:
			// 	draftSign(
			// 		interaction,
			// 		_hoistedOptions[0].value,
			// 		_hoistedOptions[1].value,
			// 		_hoistedOptions[2].member,
			// 		_hoistedOptions[3].value
			// 	);
			// 	break;
			case `update-tier`: {
				// Player to update & tier to update to
				const player = _hoistedOptions[0];
				const tier = _hoistedOptions[1].value;

				return updateTier.updateTier(interaction, player, tier);
			}
			case `renew`: {
				// Player whose contract to renew
				const player = _hoistedOptions[0];
				return renew.renew(interaction, player);
			}
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
			case `ir`: {
				const player = _hoistedOptions[0];
				return ir.ir(interaction, player);
			}
			case `retire`: {
				// Player to retire
				const player = _hoistedOptions[0];
				return retire.retire(interaction, player);
			}
			default:
				return interaction.editReply(`That's not a valid subcommand or this command is a work in progress!`);
		}
	},
};
