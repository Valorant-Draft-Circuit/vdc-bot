/*
    Programmer Notes:
        The purpose of this file is for mods and admins to run the 'mod ban @user @reason' command in VDC.
*/

// Enable strict mode
"use strict";

// Require the necessary discord.js classes
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ChatInputCommandInteraction, GuildMember } = require(`discord.js`);

// Require the necessary prisma information
const { Player } = require(`../../../../prisma`);
const { prisma } = require("../../../../prisma/prismadb");

// Require the necessary enums for this subcommand
const { ModerationNavigationOptions } = require(`../../../../utils/enums`);

/** Request to ban a user in VDC
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} user
 * @param {String} reason
 */
async function requestBan(interaction, user, reason) {
    // Get the user's data
    const userData = await Player.getBy({ discordID: user.value });

    // Run some basic error handling checks
    if (userData === null) return interaction.editReply(`This player doesn't exist!`);

    // Create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Moderation Manager` },
        description: `Are you sure you want to perform the following action?`,
        color: 0xe92929,
        fields: [
            {
                name: `\u200B`,
                value: `**Ban**\n\`  User Tag: \`\n\``,
                inline: true,
            },
            {
                name: `\u200B`,
                value: `BAN\n${user.user}\n\``,
                inline: true,
            },
        ],
        footer: { text: `Moderation — Ban` },
    });

    // Create the confirm and cancel button
    const cancel = new ButtonBuilder({
        customId: `moderation_${ModerationNavigationOptions.CANCEL}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
    });

    const confirm = new ButtonBuilder({
        customId: `moderation_${ModerationNavigationOptions.BAN_CONFIRM}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
    });

    // create the action row, add the component to it & then reply with all the data
	const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
	return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

/** Confirm that mods have reached majority and wish to petition admins
 * to ban this member from VDC
 * 
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} user
 * @param {String} reason
 */
async function confirmBan(interaction, user, reason) {
    // As mod team does not have the power to ban users from VDC
    // Do this instead

    // Message into the Admin bot-logs channel (if there is one)
    // "Moderators have reached a majority vote, and wish to petition the Admin team to ban ${user}"

    // Create a note in the ModLogs DB for the user
    // That mods petitioned to ban them at one point
}

// Export the functions
module.exports = {
	requestBan: requestBan,
	confirmBan: confirmBan,
};