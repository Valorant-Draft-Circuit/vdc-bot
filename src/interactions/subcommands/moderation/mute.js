/*
    Programmer Notes:
        The purpose of this file is for mods and admins to run the 'mod mute @user @length @reason' command in VDC.
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
const { ROLES, ModerationNavigationOptions } = require(`../../../../utils/enums`);

// Grab the helper files
const { modParseLength } = require('./helper');// Seems wrong, double check this once able to...


/** Mute a user in VDC
 * @param {ChatInputCommandInteraction} interaction
 * @param {GuildMember} user
 * @param {String} length
 * @param {String} reason
 */
async function requestMute(interaction, user, length, reason) {
    // Get the user's data
    const playerID = interaction.options._hoistedOptions[0].value.toString();
    const guildMember = await interaction.guild.members.fetch(playerID);

    // Run some basic error handling checks
    if (guildMember === null) return interaction.editReply(`This player doesn't exist!`);

    // Create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Moderation Manager` },
        description: `Are you sure you want to perform the following action?`,
        color: 0xe92929,
        fields: [
            {
                name: `\u200B`,
                value: `**Mute**\n\`  Player Tag: \`\n\`   Player ID: \`\n\`      Length: \`\n\`      Reason: \``, 
                inline: true,
            },
            {
                name: `\u200B`,
                value: `MUTE\n${user.user}\n\`${user.value}\`\n\`${length.value}\`\n\`${reason.value}\``,
                inline: true,
            },
        ],
        footer: { text: `Moderation — Mute` },
    });

    // Create the confirm and cancel button
    const cancel = new ButtonBuilder({
        customId: `moderation_${ModerationNavigationOptions.CANCEL}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
    });

    const confirm = new ButtonBuilder({
        customId: `moderation_${ModerationNavigationOptions.MUTE_CONFIRM}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
    });

    // create the action row, add the component to it & then reply with all the data
	const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
	return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

/** Confirm the mute
 * @param {ChatInputCommandInteraction} interaction
 */
async function confirmMute(interaction) {
    // Get the player data from the user's id
    const embedData = interaction.message.embeds[0].data.fields[1].value
                       .replaceAll(`\``, ``)
                       .split(`\n`);   
    const playerID  = embedData[2];
    const length    = embedData[3];
    const reason    = embedData[4];
    const guildMember = await interaction.guild.members.fetch(playerID);

    // Keep a track of the role IDs
    const removedRoles = guildMember.roles.cache.map(role => {
        if (role.id != interaction.guild.id) return role.id;
    });
    logger.log('DEBUG', `subcommands/moderation/mute.js:confirmMute - The user ${guildMember.displayName} has the following roles prior to removal: ${removedRoles}`);

    // Remove the user's roles from them
    // guildMember.roles.set([])
    //     .then(() => {
    //         // Log the removal of roles
    //         logger.log('DEBUG', `subcommands/moderation/mute.js:confirmMute - The user ${guildMember.displayName} has had their roles removed due to a Mod Mute command.`);

    //         // theoretically, could just chain another .then() here 
    //         // instead of returning a promise, but it looks tacky...
    //         return guildMember.roles.add(ROLES.MOD.MUTED);
    //     })
    //     .then(() => {
    //         // Add successful debug message of role being given
    //         logger.log('DEBUG', `subcommands/moderation/mute.js:confirmMute - The user ${guildMember.displayName} has been muted, role ${ROLES.MOD.MUTED} has been given.`);
    //     })
    //     .catch((error) => {
    //         logger.log('ERROR', `subcommands/moderation/mute.js:confirmMute - An error occurred: ${error.message}`);
    //     });

    // Get the length of the mute
    const now = new Date();
    const timeToAdd = modParseLength(length).value;

    // Generate the date for role removal
    const unmuteDate = new Date(now.getTime() + timeToAdd);

    // Use a discord timestamp format to get the date in a readable format
    const unmuteDateStringExact = `<t:${Math.floor(unmuteDate.getTime() / 1000)}:F>`;
    const unmuteDateStringRel   = `<t:${Math.floor(unmuteDate.getTime() / 1000)}:R>`;
    logger.log('DEBUG', `subcommands/moderation/mute.js:confirmMute - Current date is ${now}, user ${guildMember.displayName} will be unmuted on ${unmuteDate}`);

    // Add a `NOTE` to the modLogs db with the collection of removedRoles


    // Need the code for adding something to the modlogs in the DB
        // Need to use the `reason` argument for this
    

    // Send a message to the player (in their DMs) that they have been muted
    // in VDC main server, they are unable to talk for `length`
    // Attempt to send a message to the user once they are cut

    // Convert this to a text document, send that in the embed
    try {
        const dmEmbed = new EmbedBuilder({
            description: `Due to a rule break, you've been muted in VDC. You will be unable to talk in the main server until ${unmuteDateStringExact} (${unmuteDateStringRel}). Further rule breaks will lead to harsher punishment.
            \nThe following is the reasoning from the VDC Moderation Team on why this punishment occurred. \n\n ${reason}`,
        });
        await guildMember.send({embeds: [dmEmbed]});
    } catch (e) {
        logger.log(`WARNING`, `User ${player.name} does not have DMs open & will not receive the mute message and reasoning`);
    }

    
    // Send the confirmation message
    return interaction.editReply(`User has been muted!`);
}

// Export the functions
module.exports = {
	requestMute: requestMute,
	confirmMute: confirmMute,
};