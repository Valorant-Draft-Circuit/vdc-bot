const { MessageFlags } = require(`discord.js`);
const { prisma } = require(`../../../prisma/prismadb`);
const { getRedisClient } = require(`../../core/redis`);

/**
 * /scout follow <player>
 * /scout unfollow <player>
 * /scout list
 */
module.exports = {
    name: `scout`,

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({ content: `This command must be used inside the server.`, flags: MessageFlags.Ephemeral });
        }

        const sub = interaction.options.getSubcommand(false);
        switch (sub) {
            case `follow`:
                return follow(interaction);
            case `unfollow`:
                return unfollow(interaction);
            case `list`:
                return listFollowing(interaction);
            default:
                return interaction.reply({ content: `Unknown subcommand`, flags: MessageFlags.Ephemeral });
        }
    },
};

async function resolveScoutRoleId() {
    // try common variants for the control panel key
    const keys = [`queue_scout_role_id`, `queue_scout_rold_id`, `queue_scout_roldid`];
    for (const name of keys) {
        const row = await prisma.controlPanel.findFirst({ where: { name }, select: { value: true } });
        if (row && row.value) return String(row.value).trim();
    }
    return null;
}

async function ensureHasScoutRole(interaction) {
    const scoutRoleId = await resolveScoutRoleId();
    if (!scoutRoleId) {
        await interaction.reply({ content: `Scout role is not configured in Control Panel.`, flags: MessageFlags.Ephemeral });
        return false;
    }
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) {
        await interaction.reply({ content: `Unable to fetch your guild member record.`, flags: MessageFlags.Ephemeral });
        return false;
    }
    if (!member.roles.cache.has(scoutRoleId)) {
        await interaction.reply({ content: `You don't have the Scout role required to use this command.`, flags: MessageFlags.Ephemeral });
        return false;
    }
    return true;
}

function buildKeysForPlayerFollowers(playerId) {
    return `vdc:scouts:followers:${playerId}`;
}

function buildKeysForScoutFollowing(scoutId) {
    return `vdc:scouts:following:${scoutId}`;
}

async function follow(interaction) {
    if (!(await ensureHasScoutRole(interaction))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetUser = interaction.options.getUser(`player`);
    if (!targetUser) return interaction.editReply({ content: `Please specify a player to follow.` });

    const redis = getRedisClient();
    const followerSet = buildKeysForPlayerFollowers(targetUser.id);
    const followingSet = buildKeysForScoutFollowing(interaction.user.id);

    await redis.sadd(followerSet, interaction.user.id);
    await redis.sadd(followingSet, targetUser.id);

    return interaction.editReply({ content: `You're now following <@${targetUser.id}>. You'll be notified by DM when their queue pops.` });
}

async function unfollow(interaction) {
    if (!(await ensureHasScoutRole(interaction))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const targetUser = interaction.options.getUser(`player`);
    if (!targetUser) return interaction.editReply({ content: `Please specify a player to unfollow.` });

    const redis = getRedisClient();
    const followerSet = buildKeysForPlayerFollowers(targetUser.id);
    const followingSet = buildKeysForScoutFollowing(interaction.user.id);

    await redis.srem(followerSet, interaction.user.id);
    await redis.srem(followingSet, targetUser.id);

    return interaction.editReply({ content: `You have unfollowed <@${targetUser.id}>.` });
}

async function listFollowing(interaction) {
    if (!(await ensureHasScoutRole(interaction))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const redis = getRedisClient();
    const followingSet = buildKeysForScoutFollowing(interaction.user.id);
    const members = await redis.smembers(followingSet) || [];
    if (!members.length) return interaction.editReply({ content: `You're not following any players.` });

    // Build a simple mention list
    const lines = members.map((id) => `<@${id}>`);
    return interaction.editReply({ content: `You're following the following players:\n${lines.join(`\n`)}` });
}
