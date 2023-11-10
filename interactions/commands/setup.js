const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = require("discord.js");
const { ButtonStyle } = require(`discord.js`)

const { Player } = require("../../prisma");
const { ROLES, ButtonOptions } = require("../../utils/enums");

module.exports = {

    name: `setup`,

    async execute(interaction) {
        await interaction.deferReply();

        const { _subcommand } = interaction.options;
        switch (_subcommand) {
            case `activity-check`:
                return await activityCheck(interaction);
            default:
                return await interaction.editReply({ content: `Hey there! Looks like you're looking for functionality that doesn't exist! If you think this is wrong, please contact Travestey!`, ephemeral: true });
        }
    }
};

async function activityCheck(interaction) {
    await interaction.guild.members.fetch();

    // get all active players from the Player table and store their ID
    const allActivePlayers = await Player.getAllActive();
    const allActivePlayerIDs = allActivePlayers.map(p => p.id);

    // get all guild members with the League role & store their ID
    const leagueRole = await interaction.guild.roles.fetch(ROLES.LEAGUE.LEAGUE);
    const leagueRoleMemberIDs = await leagueRole.members.map(m => m.id);

    // get all guild members with the League role & store their ID
    const inactiveRole = await interaction.guild.roles.fetch(ROLES.LEAGUE.INACTIVE);
    const inactiveRoleMemberIDs = await inactiveRole.members.map(m => m.id);

    // filter the users to actually get the Inactive role, by making sure they ARE an active player in the Player table and DO NOT ALREADY have the inactive role
    const sharedMemberIDs = leagueRoleMemberIDs
        .filter((id) => allActivePlayerIDs.includes(id))
        .filter((id) => !inactiveRoleMemberIDs.includes(id));


    // determine potential warnings/discrepancies
    const inLeagueNotPlayerTable = leagueRoleMemberIDs.filter(id => !allActivePlayerIDs.includes(id));
    const inPlayerTableNotLeague = allActivePlayerIDs.filter(id => !leagueRoleMemberIDs.includes(id));

    // create the warnings portion of the embed message
    const warningMessage = `**Warning(s)**\n` +
        `\` ${String(inLeagueNotPlayerTable.length).padStart(3, ` `)} \` : # of users w/ <@&${ROLES.LEAGUE.LEAGUE}> role & NOT in database\n` +
        `\` ${String(inPlayerTableNotLeague.length).padStart(3, ` `)} \` : # of users w/o <@&${ROLES.LEAGUE.LEAGUE}> role but ARE in database\n` +
        `\` ${String(inactiveRoleMemberIDs.length).padStart(3, ` `)} \` : # of users who already have the <@&${ROLES.LEAGUE.INACTIVE}> role\n`;

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Activity Check` },
        description: `__Operation Overview:__\nAre you certain you want to begin the activity check? This will give ${sharedMemberIDs.length} member(s) the <@&${ROLES.LEAGUE.INACTIVE}> role.`,
        color: 0xE92929,
        fields: [{ name: `\u200B`, value: warningMessage, }],
        footer: { text: `Setup — Activity Check` }
    });

    // add cancel & confirm buttons
    const cancel = new ButtonBuilder({
        customId: `activityCheck_${ButtonOptions.CANCEL}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
    });

    const confirm = new ButtonBuilder({
        customId: `activityCheck_${ButtonOptions.ACTIVITY_CONFIRM}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
    });

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
    return await interaction.editReply({ embeds: [embed], components: [subrow] });
}