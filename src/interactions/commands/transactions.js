const { ChatInputCommandInteraction } = require("discord.js");
const { cut, sign, renew, expire, updateTier, sub, unsub, ir, captain, retire, trade, reschedule, schedulePlayoff } = require(`../subcommands/transactions`);

module.exports = {
	name: `transactions`,

	async execute(/** @type ChatInputCommandInteraction */ interaction) {
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
		 * 		consts and several share a name (e.g. `player`), which
		 * 		would collide if every case shared the switch's single
		 * 		block.
		 */
		switch (subcommand) {
			case `cut`: {
				// Player whose contract to cut
				const player = interaction.options.get(`user`);
				return cut.cut(interaction, player);
			}

			case `sign`: {
				// Player to sign & team to sign to
				const player = interaction.options.get(`user`);
				const team = interaction.options.getString(`team`);
				const contractLength = interaction.options.getString(`length`);
				return sign.sign(interaction, player, team, contractLength);
			}

			case `update-tier`: {
				// Player to update & tier to update to
				const player = interaction.options.get(`player`);
				const tier = interaction.options.getString(`tier`);

				return updateTier.updateTier(interaction, player, tier);
			}

			case `renew`: {
				// Player whose contract to renew
				const player = interaction.options.get(`user`);
				return renew.renew(interaction, player);
			}

			case `expire`: {
				// Player whose contract to expire
				const player = interaction.options.get(`user`);
				return expire.expire(interaction, player);
			}

			case `sub`: {
				// player to sub
				const subIn = interaction.options.getMember(`substitute`);
				const subOut = interaction.options.getMember(`for`);
				return sub.sub(interaction, subIn, subOut)
			}

			case `unsub`: {
				// player to unsub
				const unsubPlayer = interaction.options.getMember(`user`);
				return unsub.unsub(interaction, unsubPlayer);
			}

			case `ir`: {
				// player to IR
				const player = interaction.options.get(`user`);
				return ir.ir(interaction, player);
			}

			case `captain`: {
				// player to set as captain
				const player = interaction.options.get(`user`);
				return captain.captain(interaction, player);
			}

			case `retire`: {
				// Player to retire
				const player = interaction.options.get(`retire`);
				return retire.retire(interaction, player);
			}

			case `trade`: {
				// Franchises between which the trade happens
				const franchise1 = interaction.options.getString(`franchise-1`);
				const franchise2 = interaction.options.getString(`franchise-2`);
				return trade.trade(interaction, franchise1, franchise2);
			}

			case `reschedule`: {
				// match to reschedule
				const teamName = interaction.options.getString(`team`);
				const matchday = interaction.options.getInteger(`matchday`);
				const rescheduleDate = interaction.options.getString(`date`);
				return reschedule.reschedule(interaction, teamName, matchday, rescheduleDate);
			}

			case `schedule-playoff`: {
				// Schedule a new playoff match
				const homeTeam = interaction.options.getString(`home-team`);
				const awayTeam = interaction.options.getString(`away-team`);
				const tier = interaction.options.getString(`tier`);
				const matchType = interaction.options.getString(`match-type`);
				const matchday = interaction.options.getInteger(`matchday`);
				const date = interaction.options.getString(`date`);
				return schedulePlayoff.schedulePlayoff(interaction, homeTeam, awayTeam, tier, matchType, matchday, date);
			}

			default:
				return interaction.editReply(`That's not a valid subcommand or this command is a work in progress!`);
		}
	},
};
