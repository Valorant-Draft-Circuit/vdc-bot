const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ChatInputCommandInteraction } = require("discord.js");
const { ButtonStyle } = require(`discord.js`)

const { Player } = require("../../../prisma");
const { ROLES, ButtonOptions } = require("../../../utils/enums");

const MS_PER_API_CALL = 50; // PREDEFINED API REQUESTS RATE (MAX RATE IS 1 CALL EVERY 20 MS)

module.exports = {

    name: `setup`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply();

        const { _subcommand } = interaction.options;
        switch (_subcommand) {
            case `activity-check`:
                return await activityCheck(interaction);
            default:
                return await interaction.editReply({ content: `Hey there! Looks like you're looking for functionality that doesn't exist! If you think this is wrong, please contact Tech!`, flags: [MessageFlags.Ephemeral] });
        }
    }
};

async function activityCheck(interaction) {
    await interaction.guild.members.fetch();

    // get all active players from the Player table and store their ID
    const allActivePlayers = await Player.getAllActive();
    const allActivePlayerIDs = allActivePlayers.map(p => p.Accounts.find(a => a.provider === `discord`).providerAccountId);

    // get all guild members with the League role & store their ID
    const leagueRole = await interaction.guild.roles.fetch(ROLES.LEAGUE.LEAGUE);
    const leagueRoleMemberIDs = await leagueRole.members.map(m => m.id);

    // get all guild members with the Inactive role & store their ID
    const inactiveRole = await interaction.guild.roles.fetch(ROLES.LEAGUE.INACTIVE);
    const inactiveRoleMemberIDs = await inactiveRole.members.map(m => m.id);

    // filter the users to actually get the Inactive role, by making sure they ARE a player in the database and DO NOT ALREADY have the inactive role
    const sharedMemberIDs = leagueRoleMemberIDs
        .filter((id) => allActivePlayerIDs.includes(id))
        .filter((id) => !inactiveRoleMemberIDs.includes(id));

    // determine potential warnings/discrepancies
    const inLeagueNotDatabase = leagueRoleMemberIDs.filter(id => !allActivePlayerIDs.includes(id));
    const inDatabaseNotLeague = allActivePlayerIDs.filter(id => !leagueRoleMemberIDs.includes(id));
    const inLeagueANDInactiveANDInDatabase = leagueRoleMemberIDs
        .filter((id) => allActivePlayerIDs.includes(id))
        .filter((id) => inactiveRoleMemberIDs.includes(id));

    // create the warnings portion of the embed message
    const warningMessage = `**Warning(s)**\n` +
        `\` ${String(inLeagueNotDatabase.length).padStart(3, ` `)} \` : # of users w/ <@&${ROLES.LEAGUE.LEAGUE}> role & NOT in database\n` +
        `\` ${String(inDatabaseNotLeague.length).padStart(3, ` `)} \` : # of users w/o <@&${ROLES.LEAGUE.LEAGUE}> role but ARE in database\n` +
        `\` ${String(inactiveRoleMemberIDs.length).padStart(3, ` `)} \` : # of users who already have the <@&${ROLES.LEAGUE.INACTIVE}> role\n` +
        `\` ${String(inLeagueANDInactiveANDInDatabase.length).padStart(3, ` `)} \` : # of users w/ <@&${ROLES.LEAGUE.LEAGUE}> & <@&${ROLES.LEAGUE.INACTIVE}> roles & ARE in database\n`;

    const expectedRuntime = Math.round((MS_PER_API_CALL * sharedMemberIDs.length / 10)) / 100;

    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Activity Check` },
        description: `__Operation Overview:__\nAre you certain you want to begin the activity check? This will give ${sharedMemberIDs.length} member(s) the <@&${ROLES.LEAGUE.INACTIVE}> role. This operation should take approximately ${expectedRuntime} second(s).`,
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

    const selectMenu = new StringSelectMenuBuilder({
        customId: `activityCheckDebug`,
        placeholder: 'Optional/Debug: Select reports to generate.',
        maxValues: 5,
        options: [
            {
                label: `Users who will receive the Inactive Role`,
                value: `0`,
            },
            {
                label: `Users w/ League role & NOT in database`,
                value: `1`,
            },
            {
                label: `Users w/o League role but ARE in database`,
                value: `2`,
            },
            {
                label: `Users who already have the Inactive role`,
                value: `3`,
            },
            {
                label: `Users WITH the League & Inactive roles & ARE in the database`,
                value: `4`,
            }
        ]
    });

    // create the action row, add the component to it & then reply with all the data
    const row1 = new ActionRowBuilder({ components: [selectMenu] });
    const row2 = new ActionRowBuilder({ components: [cancel, confirm] });
    return await interaction.editReply({ embeds: [embed], components: [row1, row2] });
}