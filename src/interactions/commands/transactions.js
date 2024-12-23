"use strict";

const { cut, sign, renew, expire, updateTier, sub, unsub, ir, captain, retire, trade, reschedule } = require(`../subcommands/transactions`);


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
			case `expire`: {
				// Player whose contract to expire
				const player = _hoistedOptions[0];
				return expire.expire(interaction, player);
			}
			case `sub`: {
				// player to sub
				const subIn = _hoistedOptions[0].member;
				const subOut = _hoistedOptions[1].member;
				return sub.sub(interaction, subIn, subOut)
			}
			case `unsub`: {
				// player to unsub
				const unsubPlayer = _hoistedOptions[0].member;
				return unsub.unsub(interaction, unsubPlayer);
			}
			case `ir`: {
				const player = _hoistedOptions[0];
				return ir.ir(interaction, player);
			}
			case `captain`: {
				const player = _hoistedOptions[0];
				return captain.captain(interaction, player);
			}
			case `retire`: {
				// Player to retire
				const player = _hoistedOptions[0];
				return retire.retire(interaction, player);
			}
			case `trade`: {
				// Franchises between which the trade happens
				const franchise1 = _hoistedOptions[0].value;
				const franchise2 = _hoistedOptions[1].value;
				return trade.trade(interaction, franchise1, franchise2);
			}
			case `reschedule`: {
				// match to reschedule
				const teamName = _hoistedOptions[0].value;
				const matchday = _hoistedOptions[1].value;
				const rescheduleDate = _hoistedOptions[2].value;
				return reschedule.reschedule(interaction, teamName, matchday, rescheduleDate);
			}
			default:
				return interaction.editReply(`That's not a valid subcommand or this command is a work in progress!`);
		}
	},
};
