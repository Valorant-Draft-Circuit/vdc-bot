const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ChatInputCommandInteraction, GuildMember } = require(`discord.js`);


const { Player, Team, Transaction, Franchise, ControlPanel } = require(`../../../../prisma`);
const { ROLES, CHANNELS, TransactionsNavigationOptions } = require(`../../../../utils/enums`);
const { prisma } = require("../../../../prisma/prismadb");
const { MatchType } = require("@prisma/client");

const emoteregex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

const timestampValidator = /(?<=<t:)\d+(?=:\S>)/

/** Send confirmation to Renew a player
 * @param {ChatInputCommandInteraction} interaction
 */
async function requestReschedule(interaction, teamName, matchday, rescheduledTime) {

    const validatedTime = rescheduledTime.match(timestampValidator);
    if (validatedTime == null) return await interaction.editReply(`This is an invalid time!`);

    const time = validatedTime[0];
    const dateTime = (new Date(time * 1000)).toUTCString();

    const team = await Team.getBy({ name: teamName });
    const season = await ControlPanel.getSeason();
    const match = (await prisma.matches.findFirst({
        where: {
            AND: [
                {
                    OR: [
                        { home: team.id },
                        { away: team.id }
                    ],
                },
                { matchDay: Number(matchday) }
            ],

            season: season,
            matchType: MatchType.BO2,

        },
        include: { Home: true, Away: true, Games: true },
    }));

    if (match == undefined) return await interaction.editReply(`I couldn't find a match with those paramaters!`);
    if (match.Games.length !== 0) return await interaction.editReply(`Games were already played for this team and matchday!`);


    // create the base embed
    const embed = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `Are you sure you perform the following action?`,
        color: 0xe92929,
        fields: [
            {
                name: `\u200B`,
                value: `**Transaction**\n\`       Team: \`\n\`       Tier: \`\n\`   New Date: \`\n\`   Datetime: \`\n\`   Match ID: \``,
                inline: true,
            },
            {
                name: `\u200B`,
                value: `RESCHEDULE\n${match.Home.name} vs. ${match.Away.name}\n${match.tier}\n<t:${time}:f> (<t:${time}:R>)\n${dateTime}\n${match.matchID}`,
                inline: true,
            },
        ],
        footer: { text: `Transactions — Reschedule` },
    });


    const cancel = new ButtonBuilder({
        customId: `transactions_${TransactionsNavigationOptions.CANCEL}`,
        label: `Cancel`,
        style: ButtonStyle.Danger,
    });

    const confirm = new ButtonBuilder({
        customId: `transactions_${TransactionsNavigationOptions.RESCHEDULE_CONFIRM}`,
        label: `Confirm`,
        style: ButtonStyle.Success,
    });

    // create the action row, add the component to it & then reply with all the data
    const subrow = new ActionRowBuilder({ components: [cancel, confirm] });
    return await interaction.editReply({ embeds: [embed], components: [subrow] });
}

async function confirmReschedule(interaction) {

    const params = interaction.message.embeds[0].fields[1].value
        .replaceAll(`\``, ``).split(`\n`);

    const teams = params[1].split(` vs. `);
    const timestamp = params[3];
    const matchID = Number(params[5]);
    const datetime = new Date(params[4]);

    await Transaction.reschedule(matchID, datetime);

    const embed = interaction.message.embeds[0];
    const embedEdits = new EmbedBuilder(embed);
    embedEdits.setDescription(`This operation was successfully completed.`);
    embedEdits.setFields([]);
    await interaction.message.edit({ embeds: [embedEdits], components: [] });

    // create the base embed
    const announcement = new EmbedBuilder({
        author: { name: `VDC Transactions Manager` },
        description: `The match between ${teams.join(` & `)} has been rescheduled to\n${timestamp}`,
        color: 0xe92929,
        footer: { text: `Transactions — Reschedule` },
        timestamp: Date.now(),
    });

    await interaction.deleteReply();
    const transactionsChannel = await interaction.guild.channels.fetch(CHANNELS.TRANSACTIONS);
    return await transactionsChannel.send({ embeds: [announcement] });
}

module.exports = {
    requestReschedule: requestReschedule,
    confirmReschedule: confirmReschedule,
};
