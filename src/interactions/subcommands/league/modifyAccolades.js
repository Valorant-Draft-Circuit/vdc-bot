const { ChatInputCommandInteraction, GuildMember } = require(`discord.js`);
const { Player } = require("../../../../prisma");
const { prisma } = require("../../../../prisma/prismadb");
const { decodeAccoladeData } = require("../../../helpers/league/accolades");

async function modifyAccolades(/** @type ChatInputCommandInteraction */ interaction) {
    // command params
    const operation = interaction.options.getString(`operation`);
    const shorthand = interaction.options.getString(`accolade`);
    const season = interaction.options.getNumber(`season`);
    const tier = interaction.options.getString(`tier`);
    /** @type {GuildMember} */
    const guildMember = interaction.options.getMember(`player`);

    console.log(operation, shorthand, season, tier);

    const player = await Player.getBy({ discordID: guildMember.id });
    if (player == null) return await interaction.editReply(`This player (${guildMember}, \`${guildMember.user.username}\`, \`${guildMember.id}\`) does not exist in our database!`);

    const tierFormatted = tier[0].toUpperCase() + tier.substring(1).toLowerCase();
    const accoladeData = decodeAccoladeData(shorthand, tierFormatted, season);

    const cmdRunBy = interaction.user;

    if (operation == `add`) {
        const toAdd = await prisma.accolades.findFirst({
            where: {
                userID: player.id,
                season: Number(season),
                tier: tier,
                shorthand: shorthand,
                accolade: accoladeData.readable
            }
        });

        if (toAdd != null) return await interaction.editReply({ content: `This player (${guildMember}, \`${guildMember.user.username}\`, \`${guildMember.id}\`) already has this accolade!` });

        await prisma.accolades.create({
            data: {
                userID: player.id,
                season: Number(season),
                tier: tier,
                shorthand: shorthand,
                accolade: accoladeData.readable
            }
        });

        logger.log(`VERBOSE`, `${cmdRunBy} (\`${cmdRunBy.username}\`, \`${cmdRunBy.id}\`) added accolade ${accoladeData.title} (${accoladeData.emote}) to ${guildMember} (\`${guildMember.user.username}\`, \`${guildMember.id}\`)`);
        return await interaction.editReply({ content: `Added accolade \`${accoladeData.title}\` (${accoladeData.emote}) to ${guildMember} (\`${guildMember.user.username}\`, \`${guildMember.id}\`)` });

    } else {
        const toRemove = await prisma.accolades.findFirst({
            where: {
                userID: player.id,
                season: Number(season),
                tier: tier,
                shorthand: shorthand,
                accolade: accoladeData.readable
            }
        });

        if (toRemove == null) return await interaction.editReply({ content: `This player (${guildMember}, \`${guildMember.user.username}\`, \`${guildMember.id}\`) does not have this accolade!` });
        else {
            await prisma.accolades.delete({ where: { id: toRemove.id } });
            logger.log(`VERBOSE`, `${cmdRunBy} (\`${cmdRunBy.username}\`, \`${cmdRunBy.id}\`) removed accolade ${accoladeData.title} (${accoladeData.emote}) from ${guildMember} (\`${guildMember.user.username}\`, \`${guildMember.id}\`)`);
            return await interaction.editReply({ content: `Removed accolade \`${accoladeData.title}\` (${accoladeData.emote}) from ${guildMember} (\`${guildMember.user.username}\`, \`${guildMember.id}\`)` });
        }
    }
}

module.exports = {
    modifyAccolades: modifyAccolades
}