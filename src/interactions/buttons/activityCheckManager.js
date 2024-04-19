const { EmbedBuilder } = require("discord.js");

const { Player } = require(`../../../prisma`);
const { ROLES, ButtonOptions } = require(`../../../utils/enums`);

const MS_PER_API_CALL = 50; // PREDEFINED API REQUESTS RATE (MAX RATE IS 1 CALL EVERY 20 MS)

module.exports = {

    id: `activityCheckManager`,

    async execute(interaction, args) {
        switch (Number(args)) {
            case ButtonOptions.ACTIVITY_CONFIRM:
                return await confirm(interaction);

            case ButtonOptions.CANCEL:
                return await cancel(interaction);

            default:
                return await interaction.reply({ content: `There was an error. ERR: BTN_ACT_CHK_MGR` });
        }
    }
};

async function confirm(interaction) {
    await interaction.deferUpdate(); // defer as early as possible
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

    /** Callback function to fetch the user given a user ID and give them the Inactive role
     * @param {String} userID Discord user ID
     */
    const addInactiveRole = async (userID) => {
        const guildMember = await interaction.guild.members.fetch(userID);
        if (!guildMember._roles.includes(ROLES.LEAGUE.INACTIVE)) return await guildMember.roles.add(ROLES.LEAGUE.INACTIVE);
    };

    /** Callback function to update the embed once the entire queue is finished processing */
    const finishProcessingMessage = async () => {
        const embed = interaction.message.embeds[0];
        const embedEdits = new EmbedBuilder(embed);

        embedEdits.setDescription(`This operation is complete. ${sharedMemberIDs.length} member(s) were given the <@&${ROLES.LEAGUE.INACTIVE}> role.`);

        return await interaction.message.edit({ embeds: [embedEdits], components: [] });
    }

    // begin processing the queue
    processQueue(sharedMemberIDs, MS_PER_API_CALL, addInactiveRole, finishProcessingMessage);

    // update the embed with the expected runtime & remove all the components
    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);

    const expectedRuntime = Math.round((MS_PER_API_CALL * sharedMemberIDs.length / 10)) / 100;
    embedEdits.setDescription(`The queue is being processed. This operation should take approximately ${expectedRuntime} second(s).`);
    embedEdits.setFields([]);

    return await interaction.message.edit({ embeds: [embedEdits], components: [] });
}

async function cancel(interaction) {
    await interaction.deferUpdate(); // defer as early as possible

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);

    embedEdits.setDescription(`This operation was cancelled.`);
    embedEdits.setFields([]);

    return await interaction.message.edit({ embeds: [embedEdits], components: [] });
}

/** Function to process an array of items at a set interval (in ms) with a function to execute on each array index
 * @param {Array} arr Array to iterate though and process
 * @param {Number} queueInterval Interval to process the queue at (in ms)
 * @param {Function} intervalCallback Callback function to execute every <queueInterval> ms with an index of <arr> as the argument
 * @param {Function} endIntervalQueueCallback Callback function to execute once the queue is finished processing
 */
async function processQueue(arr, queueInterval, intervalCallback, endIntervalQueueCallback) {
    let index = 0;

    const endQueueProcessing = async (intervalID) => {
        clearInterval(intervalID);
        return await endIntervalQueueCallback();
    };

    const intervalID = setInterval(async () => {
        intervalCallback(arr[index]);
        index++

        if (arr[index] === undefined) return endQueueProcessing(intervalID);
    }, queueInterval);
}