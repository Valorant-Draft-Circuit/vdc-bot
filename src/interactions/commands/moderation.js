// Enable strict mode
"use strict";

// Grab all commands 
const { mute, ban } = require(`../subcommands/moderation`);
const { modParseLength } = require(`../subcommands/moderation/helper`);

// Create the exported commands
module.exports = {
	name: `moderation`,

	async execute(interaction) {
		// Defer the interaction's reply as early as possible
        await interaction.deferReply();

        // Get the command and the options passed to the interaction
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
         * 
         *      For this current file, the order of `_hoistedOptions` is located
         *      in utils/commandsStructure/moderation.js.
		 */
		switch (_subcommand) {
				// Note: All of these are objects of format
				/*
					{
						type: #,
						name: 'name',
						value: actual_val_you_expect
					}
				*/

			case `ban`: {
				const player = _hoistedOptions[0]; // Player to ban
				const reason = _hoistedOptions[1]; // Why they are being banned

				return ban.ban(player, reason);
			}

            case `mute`: {
                const player = _hoistedOptions[0]; // Player to mute
                const length = _hoistedOptions[1]; // How long to mute

                // Check to see if the length passed in is a viable length
                var temp = modParseLength(length.value);
				if (!temp.success) return interaction.editReply(`The length entered of [${length}] is invalid`)
                // Is this good to have here? Ask Trav on opinions

                const reason = _hoistedOptions[2]; // Why they are being muted
                return mute.mute(interaction, player, length, reason); 
            }
            
            // This statement will run when the switch statement FAILS
            // to match the `_subcommand`
			default:
				return interaction.editReply(`That's not a valid subcommand or this command is a work in progress!`);
		}
	},
};
