const { ChatInputCommandInteraction, GuildMember } = require(`discord.js`);
const { Player } = require("../../../../prisma");
const { prisma } = require("../../../../prisma/prismadb");

async function modifyAccolades(/** @type ChatInputCommandInteraction */ interaction) {
    const { _hoistedOptions } = interaction.options;

    // command params
    const operation = _hoistedOptions.find(o => o.name == `operation`).value;
    const shorthand = _hoistedOptions.find(o => o.name == `accolade`).value;
    const season = _hoistedOptions.find(o => o.name == `season`).value;
    const tier = _hoistedOptions.find(o => o.name == `tier`).value;
    /** @type {GuildMember} */
    const guildMember = _hoistedOptions.find(o => o.name == `player`).member;

    console.log(operation, shorthand, season, tier);

    const player = await Player.getBy({ discordID: guildMember.id });
    if (player == null) return await interaction.editReply(`This player (${guildMember}, \`${guildMember.user.username}\`, \`${guildMember.id}\`) does not exist in our database!`);

    const tierFormatted = tier[0].toUpperCase() + tier.substring(1).toLowerCase();
    const accoladeData = decodeAccoladeData(shorthand, tierFormatted, season);

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

        const cmdRunBy = interaction.user;

        logger.log(`INFO`, `${cmdRunBy} (\`${cmdRunBy.username}\`, \`${cmdRunBy.id}\`) added accolade ${accoladeData.title} (${accoladeData.emote}) to ${guildMember} (${guildMember.user.username}, \`${guildMember.id}\`)`);
        return await interaction.editReply({ content: `Added accolade \`${accoladeData.title}\` (${accoladeData.emote}) to ${guildMember} (${guildMember.user.username}, \`${guildMember.id}\`)` });

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
            logger.log(`INFO`, `${cmdRunBy} (\`${cmdRunBy.username}\`, \`${cmdRunBy.id}\`) removed accolade ${accoladeData.title} (${accoladeData.emote}) from ${guildMember} (${guildMember.user.username}, \`${guildMember.id}\`)`);
            return await interaction.editReply({ content: `Removed accolade \`${accoladeData.title}\` (${accoladeData.emote}) from ${guildMember} (${guildMember.user.username}, \`${guildMember.id}\`)` });
        }
    }
}

module.exports = {
    modifyAccolades: modifyAccolades
}

function decodeAccoladeData(shorthand, tier, season) {
    const defs = {
        WIN: {
            readable: `Winner`, emote: `🏆`, title: `Grand Finals Winner`,
            description: `Player for the Winning Season ${season} ${tier} Team`
        },
        WIN_FM: {
            readable: `Franchise Management`, emote: `👑`, title: `Franchise Management for a Winning Grand Finals Team`,
            description: `Franchise Manager for the Winning Season ${season} ${tier} Team`
        },
        WIN_SUB: {
            readable: `Substitute`, emote: `🥈`, title: `Substitute for a Player in a Grand Finals Match`,
            description: `Substitute for the Winning Season ${season} ${tier} Team during Grand Finals`
        },
        AST: {
            readable: `All Star`, emote: `⭐`, title: `All Star`,
            description: `All Star for Season ${season} ${tier} Tier`
        },
        MVP: {
            readable: `MVP`, emote: `🏅`, title: `Most Valuable Player`,
            description: `MVP of ${tier} Season ${season}`
        },
    }

    return defs[shorthand];
}