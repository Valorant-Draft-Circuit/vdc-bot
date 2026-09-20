const { MessageFlags } = require(`discord.js`);
const { prisma } = require(`../../../prisma/prismadb`);
const { dedupeNickname } = require(`../../helpers/nickname`);

module.exports = {
	id: `nickdedupeManager`,

	/**
	 * @param {import('discord.js').ButtonInteraction} interaction
	 * @param {string} action `confirm` or `keep`
	 */
	async execute(interaction, action = ``) {
		const invokerId = interaction.message.interactionMetadata?.user?.id ?? interaction.message.interaction?.user?.id;
		if (!invokerId || interaction.user.id !== invokerId) {
			return interaction.reply({ content: `Only the person who ran \`/profile update\` can respond to this.`, flags: MessageFlags.Ephemeral });
		}

		if (action === `keep`) {
			return interaction.update({ content: `Keeping your nickname as is.`, components: [] });
		}

		const guildMember = await interaction.guild.members.fetch(interaction.user.id);

		// grab the slug from the nickname itself. non-playing GMs have no player.Team so we can't look it up that way
		const nicknamePrefix = (guildMember.nickname ?? ``).split(` | `)[0] || null;
		const franchise = nicknamePrefix ? await prisma.franchise.findFirst({ where: { slug: nicknamePrefix, active: true } }) : null;
		if (!franchise) return interaction.update({ content: `You're no longer on a franchise, so there's nothing to dedupe.`, components: [] });

		const dedupedNickname = dedupeNickname(franchise.slug, guildMember.nickname ?? ``);
		if (!dedupedNickname) return interaction.update({ content: `Your nickname already looks clean.`, components: [] });
		if (!guildMember.manageable) return interaction.update({ content: `I don't have permission to change your nickname - please update it manually.`, components: [] });

		try {
			await guildMember.setNickname(dedupedNickname);
		} catch (error) {
			logger.log(`WARNING`, `Failed to dedupe nickname for ${interaction.user.id}`, error.stack);
			return interaction.update({ content: `I couldn't change your nickname - please update it manually or open a tech ticket.`, components: [] });
		}
		return interaction.update({ content: `Done - your nickname is now \`${dedupedNickname}\`.`, components: [] });
	},
};
