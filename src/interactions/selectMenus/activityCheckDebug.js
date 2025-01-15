const fs = require(`fs`);
const { StringSelectMenuInteraction } = require(`discord.js`)

const { Player } = require(`../../../prisma`);
const { ROLES, ButtonOptions } = require(`../../../utils/enums`);

module.exports = {

    id: `activityCheckDebug`,

    async execute(/** @type StringSelectMenuInteraction */ interaction) {
        await interaction.deferReply();
        await interaction.message.edit({components: interaction.message.components});
        
        const allGuildMembers = await interaction.guild.members.fetch();

        // get all active players from the Player table and store their ID
        const allActivePlayers = await Player.getAllActive();
        const allActivePlayerIDs = allActivePlayers.map(p => p.Accounts.find(a => a.provider === `discord`).providerAccountId);
        // console.log(allActivePlayerIDs)

        // get all guild members with the League role & store their ID
        const leagueRole = await interaction.guild.roles.fetch(ROLES.LEAGUE.LEAGUE);
        const leagueRoleMemberIDs = await leagueRole.members.map(m => m.id);
        // console.log(`LEAGUE ROLES`)
        // console.log(leagueRoleMemberIDs)

        // get all guild members with the Inactive role & store their ID
        const inactiveRole = await interaction.guild.roles.fetch(ROLES.LEAGUE.INACTIVE);
        const inactiveRoleMemberIDs = await inactiveRole.members.map(m => m.id);
        // console.log(`INACTIVE ROLE`)
        // console.log(leagueRoleMemberIDs)


        // filter the users to actually get the Inactive role, by making sure they ARE a player in the database and DO NOT ALREADY have the inactive role
        const sharedMemberIDs = leagueRoleMemberIDs
            .filter((id) => allActivePlayerIDs.includes(id))
            .filter((id) => !inactiveRoleMemberIDs.includes(id));
        // console.log(`SHARED IDs (IN DB AND NOT ALREDAY HAVE INACTIVE)`)
        // console.log(leagueRoleMemberIDs)


        // determine potential warnings/discrepancies
        const inLeagueNotPlayerTable = leagueRoleMemberIDs.filter(id => !allActivePlayerIDs.includes(id));
        const inPlayerTableNotLeague = allActivePlayerIDs.filter(id => !leagueRoleMemberIDs.includes(id));
        const inLeagueANDInactiveANDInPlayerTable = leagueRoleMemberIDs
            .filter((id) => allActivePlayerIDs.includes(id))
            .filter((id) => inactiveRoleMemberIDs.includes(id));


        // The following are various functions to dynamically generate the reports. Each takes an array of
        // discord IDs and filters all the server's users to generate the following output format => ID : username
        const getUsersToReceiveInactiveRole = async () => {
            const filteredUsers = allGuildMembers.filter((member) => sharedMemberIDs.includes(member.id));
            const outputArray = filteredUsers.map((u) => `${u.id.padEnd(20, ` `)} :  ${u.user.username}`);

            return `\n\nUsers who will receive the Inactive role (${outputArray.length})\n` + `=`.padEnd(75, `=`) + `\n` + outputArray.join(`\n`) + `\n` + `=`.padEnd(75, `=`);
        }

        const getUsersWithLeagueRoleNotInDatabase = async () => {
            const filteredUsers = allGuildMembers.filter((member) => inLeagueNotPlayerTable.includes(member.id));
            const outputArray = filteredUsers.map((u) => `${u.id.padEnd(20, ` `)} :  ${u.user.username}`);

            return `\n\nUsers who have the League role but are NOT in the database (${outputArray.length})\n` + `=`.padEnd(75, `=`) + `\n` + outputArray.join(`\n`) + `\n` + `=`.padEnd(75, `=`);
        }

        const getUsersWithoutLeagueRoleInDatabase = async () => {
            const filteredUsers = allGuildMembers.filter((member) => inPlayerTableNotLeague.includes(member.id));
            const outputArray = filteredUsers.map((u) => `${u.id.padEnd(20, ` `)} :  ${u.user.username}`);

            return `\n\nUsers who DO NOT have the League role but are in the database (${outputArray.length})\n` + `=`.padEnd(75, `=`) + `\n` + outputArray.join(`\n`) + `\n` + `=`.padEnd(75, `=`);
        }

        const getUsersWithInactiveRole = async () => {
            const filteredUsers = allGuildMembers.filter((member) => inactiveRoleMemberIDs.includes(member.id));
            const outputArray = filteredUsers.map((u) => `${u.id.padEnd(20, ` `)} :  ${u.user.username}`);

            return `\n\nUsers who ALREADY HAVE the Inactive role (${outputArray.length})\n` + `=`.padEnd(75, `=`) + `\n` + outputArray.join(`\n`) + `\n` + `=`.padEnd(75, `=`);
        }
        const getUsersWithLeagueAndInactiveRolesAndInDatabase = async () => {
            const filteredUsers = allGuildMembers.filter((member) => inLeagueANDInactiveANDInPlayerTable.includes(member.id));
            const outputArray = filteredUsers.map((u) => `${u.id.padEnd(20, ` `)} :  ${u.user.username}`);

            return `\n\nUsers WITH the League & Inactive roles & ARE in the database (${outputArray.length})\n` + `=`.padEnd(75, `=`) + `\n` + outputArray.join(`\n`) + `\n` + `=`.padEnd(75, `=`);
        }

        let report = `Activity Check Debug Report`;

        if (interaction.values.includes(`0`)) report += await getUsersToReceiveInactiveRole();
        if (interaction.values.includes(`1`)) report += await getUsersWithLeagueRoleNotInDatabase();
        if (interaction.values.includes(`2`)) report += await getUsersWithoutLeagueRoleInDatabase();
        if (interaction.values.includes(`3`)) report += await getUsersWithInactiveRole();
        if (interaction.values.includes(`4`)) report += await getUsersWithLeagueAndInactiveRolesAndInDatabase();

        // create the file
        const filePath = `./cache/activityCheckReport.txt`;
        fs.writeFileSync(filePath, report);

        await interaction.editReply({ content: `Here's your report!`, files: [filePath] });
    }
};