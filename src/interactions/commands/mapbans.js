const { EmbedBuilder, ChatInputCommandInteraction, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { Games, Team, ControlPanel, Player } = require("../../../prisma");
const { GameType, MatchType } = require("@prisma/client");
const { prisma } = require("../../../prisma/prismadb");
const { CHANNELS } = require("../../../utils/enums/channels");

const sum = (array) => array.reduce((s, v) => s += v == null ? 0 : v, 0);
const playoffsCutoff = {
    prospect: 4,
    apprentice: 6,
    expert: 6,
    mythic: 4
};

const COLORS = {
    PROSPECT: 0xFEC335,
    APPRENTICE: 0x72C357,
    EXPERT: 0x04AEE4,
    MYTHIC: 0xA657A6,
}


module.exports = {

    name: `mapbans`,

    async execute(/** @type ChatInputCommandInteraction */ interaction) {
        await interaction.deferReply({ ephemeral: true });

        const player = await Player.getBy({ discordID: interaction.user.id });
        if (player == null) return await interaction.editReply(`You are not in our database!`);
        if (player.team == null) return await interaction.editReply(`You are not on a team!`);


        const season = await ControlPanel.getSeason();
        const matches = await prisma.matches.findMany({
            where: {
                OR: [
                    { home: player.team },
                    { away: player.team },
                ],
                season: season,
                matchType: MatchType.BO2,
            },
            include: {
                Home: { include: { Franchise: true } },
                Away: { include: { Franchise: true } },
            }
        });

        const nextMatch = matches.filter(m => m.dateScheduled > Date.now())[0];
        const channelName = `bans│${player.Team.tier[0]}│${nextMatch.Home.Franchise.slug}-${nextMatch.Away.Franchise.slug}`.toLowerCase();

        console.log(channelName)

        const activebans = (await interaction.guild.channels.fetch())
            .filter(c => c.parentId == CHANNELS.CATEGORIES.MAPBANS).map(c => { return { name: c.name, id: c.id } });


        console.log(activebans)
        console.log(channelName)

        const mp = await ControlPanel.getBansInfo(nextMatch.matchType);

        const banOrderReadable = mp.banOrderReadable;
        const mapPool = mp.mapPool;

        console.log(mp)


        // for (let i = 0; i < activebans.length; i++) {
        //     console.log(activebans[i], channelName, activebans[i] == channelName)

        // }
        // console.log()

        // return
        // // .guild.channels.exists('name', channelName)
        if (activebans.map(c => c.name).includes(channelName)) {
            //checks if there in an item in the channels collection that corresponds with the supplied parameters, returns a boolean
            return await interaction.editReply({
                content: `The <#${activebans.find(c => c.name == channelName).id}> channel already exists in this guild.`
            });
        }


        const embed = new EmbedBuilder({
            title: `Map Bans: ${nextMatch.Home.name} v. ${nextMatch.Away.name}`,
            description:
                `**Home** : ${nextMatch.Home.Franchise.name} - ${nextMatch.Home.name}\n` +
                `**Away** : ${nextMatch.Away.Franchise.name} - ${nextMatch.Away.name}\n\n` +
                `**Ban Order** :\n${banOrderReadable.join(`, `)}\n` +
                `**Map Pool** :\n${mapPool.join(`, `)}\n`,
            color: COLORS[nextMatch.Home.tier]
        });






        const newchannel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: CHANNELS.CATEGORIES.MAPBANS,
        });

        newchannel.send({
            embeds: [embed],
            components: [new ActionRowBuilder({
                components: [
                    new ButtonBuilder({
                        customId: `del`,
                        style: ButtonStyle.Danger,
                        label: `DELETE`
                    })
                ]
            })]
        })



        return await interaction.editReply(`ok: ${newchannel}`);
    }
}
