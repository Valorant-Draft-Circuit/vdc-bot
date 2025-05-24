const { ButtonInteraction, EmbedBuilder, ButtonBuilder, ActionRowBuilder, MessageFlags, ButtonStyle } = require(`discord.js`);
const { ButtonOptions } = require(`../../../utils/enums`);
const { updateDescription } = require("../subcommands/franchise");
const { MapBansSide, MapBanType } = require("@prisma/client");
const { prisma } = require("../../../prisma/prismadb");

module.exports = {
    id: `mapbansManager`,

    async execute(/** @type ButtonInteraction */ interaction, args) {
        await interaction.deferReply({ ephemeral: true }); // defer as early as possible

        const splitargs = args.split(`-`);
        console.log(splitargs)

        const matchID = Number(splitargs[1]);
        const order = Number(splitargs[2]);
        const side = splitargs[0] == `attack` ? MapBansSide.ATTACK : MapBansSide.DEFENSE;
        const sideEmote = splitargs[0] == `attack` ? `⚔️` : `🛡️`;

        const mapbans = await prisma.mapBans.findMany({ where: { matchID: matchID }, include: { Team: { include: { Franchise: { include: { Brand: true } } } } } });

        // console.log(mapbans)

        const curentSelection = mapbans.find(mb => mb.order == order);
        const nextSelection = mapbans.find(mb => mb.order == order + 1);

        console.log(curentSelection, nextSelection);



        const [mapbansResponse, mapsResponse] = await Promise.all([
            prisma.mapBans.update({ where: { id: curentSelection.id }, data: { side: side } }),
            fetch(`https://valorant-api.com/v1/maps`)
        ]);
        if (!mapsResponse.ok) return logger.log(`ERROR`, `There was an error fetching map data!`)
        const maps = (await mapsResponse.json()).data;


        const mapData = maps.find(m => m.displayName == curentSelection.map);
        const emote = interaction.message.content.match(/(<:\w+:)\d+>/)[0];
        await interaction.message.edit({ content: `${emote} \`${curentSelection.Team.name}\` select ${sideEmote} \`${side}\` on \`${curentSelection.map}\``, components: [], files: [mapData.listViewIcon] });


        if (nextSelection.type == MapBanType.DISCARD || nextSelection.type == MapBanType.DECIDER) {
            return interaction.channel.send({content: `DONE`})
        }





        // const teamIDs = Array.from(new Set(mapbans.map(nb => nb.Team.id)));
        // const pickingTeamId = teamIDs.filter(tid => tid != firstPick.team)[0];
        // const teams = [
        //     mapbans.find(nb => nb.team == pickingTeamId).Team,
        //     mapbans.find(nb => nb.team != pickingTeamId).Team
        // ];





        const attack = new ButtonBuilder({
            customId: `mapbans_attack-${nextSelection.matchID}-${nextSelection.order}`,
            label: `Attack`,
            style: ButtonStyle.Secondary,
            emoji: `⚔️`
        });

        const defense = new ButtonBuilder({
            customId: `mapbans_defense-${nextSelection.matchID}-${nextSelection.order}`,
            label: `Defense`,
            style: ButtonStyle.Secondary,
            emoji: `🛡️`
        });
        const subrow = new ActionRowBuilder({ components: [attack, defense] });

        return await interaction.channel.send({
            content: `<@&${nextSelection.Team.Franchise.roleID}>, it's (<${nextSelection.Team.Franchise.Brand.discordEmote}> \`${nextSelection.Team.name}\`)'s turn to pick a side for \`${nextSelection.map}\`!`,
            components: [subrow]
        });

        // switch (splitargs[0]) {
        //     case `attack`: {

        //     }
        //     case `defense`: {

        //     }
        //     default: {
        //         await interaction.reply({ content: `There was an error. Expected <\`attack\` or \`defense\`> as an argument and got \`${splitargs[0]}\` instead.` })
        //         throw new Error(`Expected <\`attack\` or \`defense\`> as an argument and got \`${splitargs[0]}\` instead.`);
        //     }
        // }
    }
};

async function attack() {

}


// async function cancel(/** @type ChatInputCommandInteraction */ interaction) {
//     // delete the reply and then edit the original embed to show cancellation confirmation
//     await interaction.deleteReply();

//     const embed = interaction.message.embeds[0];
//     const embedEdits = new EmbedBuilder(embed);

//     embedEdits.setDescription(`This operation was cancelled.`);
//     embedEdits.setFields([]);

//     return await interaction.message.edit({
//         embeds: [embedEdits],
//         components: [],
//     });
// }
