const { Player, Transaction } = require("../../../prisma");
const { CHANNELS, ROLES, PlayerStatusCode } = require(`../../../utils/enums`);

const validStatusesToDE = [PlayerStatusCode.PENDING, PlayerStatusCode.FREE_AGENT, PlayerStatusCode.RESTRICTED_FREE_AGENT];
const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

module.exports = {

    name: `welcome`,

    async execute(interaction) {
        // defer replying to the interaction
        await interaction.deferReply();

        // destrcture options & store relevant information
        const { _hoistedOptions } = interaction.options;
        const player = _hoistedOptions[0];
        const status = _hoistedOptions[1].value;

        // get player information from DB and guild info (guildMember & channel)
        const playerData = await Player.getBy({ discordID: player.value });
        const guildMember = await interaction.guild.members.fetch(player.value);
        const acceptedChannel = await interaction.guild.channels.fetch(CHANNELS.ACCEPTED_MEMBERS);


        // status checks
        // check to see if the bot can perform any actions on this user (i.e. if the bot isn't high enough in role hierarchy)
        if (!guildMember.manageable) return await interaction.editReply({ content: `I can't manage this player- their roles are higher than mine! You will need to perform this action manually!` });
        if (playerData == undefined) return await interaction.editReply({ content: `This player doesn't exist!` });
        if (!validStatusesToDE.includes(playerData.status)) return await interaction.editReply({ content: `This player doesn't have a player status of Pending, FA or RFA and cannot become Draft Eligible!` });

        // renove the viewer role & add the league role
        if (guildMember._roles.includes(ROLES.LEAGUE.VIEWER)) await guildMember.roles.remove(ROLES.LEAGUE.VIEWER);
        await guildMember.roles.add(ROLES.LEAGUE.LEAGUE);

        // update the name to match convention
        const ign = (await Player.getIGNby({ discordID: player.value })).split(`#`)[0];
        const accolades = guildMember.nickname?.match(emoteregex);
        guildMember.setNickname(`${status} | ${ign} ${accolades ? accolades.join(``): ``}`);

        // assign the proper roles & send the correct message
        switch (status) {
            case `DE`:
                await guildMember.roles.add(ROLES.LEAGUE.DRAFT_ELIGIBLE);
                await Transaction.updateStatus({ playerID: player.value, status: PlayerStatusCode.DRAFT_ELIGIBLE });
                acceptedChannel.send({ content: `Welcome ${player.user} to the league!!` });
                break;
            case `RFA`:
                await guildMember.roles.add(ROLES.LEAGUE.RESTRICTED_FREE_AGENT);
                await Transaction.updateStatus({ playerID: player.value, status: PlayerStatusCode.RESTRICTED_FREE_AGENT });
                acceptedChannel.send({ content: `Welcome ${player.user} to the league as an RFA!` });
                break;
            default:
                throw new Error(`INVALID STATUS VALUE. EXPECTED DE or RFA & instead got ${status}`);
        }

        return await interaction.editReply({ content: `${player.user} was welcomed to the league as ${status == `DE` ? `a` : `an`} ${status}!` });
    }
};
