const { ChatInputCommandInteraction } = require(`discord.js`);
const { prisma } = require(`../../../../prisma/prismadb`);
const { CHANNELS } = require(`../../../../utils/enums/channels`);

async function mapbansState(/** @type ChatInputCommandInteraction */ interaction) {
    const channel = interaction.channel;

    if (channel.parent?.id !== CHANNELS.CATEGORIES.MAPBANS) {
        return interaction.editReply(`This command can only be run inside a mapban channel.`);
    }

    const topic = channel.topic;
    if (!topic) return interaction.editReply(`This channel has no topic — cannot determine match ID.`);

    const topicMatch = topic.match(/Match ID: (\d+)/);
    if (!topicMatch) return interaction.editReply(`Could not parse a match ID from this channel's topic.`);

    const matchID = Number(topicMatch[1]);

    const mapBans = await prisma.MapBans.findMany({
        where: { matchID },
        orderBy: { order: `asc` },
        include: { Team: { select: { name: true } } }
    });

    if (!mapBans || mapBans.length === 0) {
        return interaction.editReply(`No map ban entries found for match ID \`${matchID}\`.`);
    }

    const rows = mapBans.map(b =>
        `[${b.order}] id:${b.id}  type:${b.type.padEnd(7)}  team:${(b.Team?.name ?? `null`).padEnd(20)}  map:${(b.map ?? `null`).padEnd(15)}  side:${b.side ?? `null`}`
    ).join(`\n`);

    return interaction.editReply(`**MapBans DB state for match \`${matchID}\`** (from topic: \`${topic.split(` | `)[0]}\`):\n\`\`\`\n${rows}\n\`\`\``);
}

module.exports = { mapbansState };
