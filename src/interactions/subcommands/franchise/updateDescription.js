const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require(`discord.js`);
const { ChatInputCommandInteraction, GuildMember } = require(`discord.js`);
const fs = require('fs');

const { CHANNELS } = require(`../../../../utils/enums`);
const { prisma } = require(`../../../../prisma/prismadb`);

const { refreshFranchisesChannel } = require('../league');

const imagepath = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/`;
const embedFieldMaxLength = 1024;

const getAllIndexes = (arr, val) => {
	let indexes = [], i;
	for (i = 0; i < arr.length; i++)
		if (arr[i] === val) { indexes.push(i); }
	return indexes;
}

/** Send confirmation to sign a player
 * @param {ChatInputCommandInteraction} interaction 
 * @param {GuildMember} player 
 * @param {String} team 
 */
async function confirmUpdate(interaction) {
	const { _hoistedOptions } = interaction.options;

	const attachment = _hoistedOptions[0].attachment
	if (!attachment.name.endsWith(`.txt`)) return await interaction.editReply(`Please only upload \`*.txt\` files. \`${attachment.name}\` is not a text file.`);

	const gmids = (await prisma.franchise.findMany({
		include: {
			GM: { include: { Accounts: true } },
			AGM1: { include: { Accounts: true } },
			AGM2: { include: { Accounts: true } },
			AGM3: { include: { Accounts: true } },
			AGM4: { include: { Accounts: true } },
		}
	})).map(f => {
		return [
			f.GM?.Accounts.find(a => a.provider == `discord`).providerAccountId,
			f.AGM1?.Accounts.find(a => a.provider == `discord`).providerAccountId,
			f.AGM2?.Accounts.find(a => a.provider == `discord`).providerAccountId,
			f.AGM3?.Accounts.find(a => a.provider == `discord`).providerAccountId,
			f.AGM4?.Accounts.find(a => a.provider == `discord`).providerAccountId,
		]
	}).flat().filter(v => v !== undefined);

	if (!gmids.includes(interaction.user.id)) return await interaction.editReply(`You are not a GM or AGM for any franchise and cannot use this command.`);

	// Fetch the attachment content
	const response = await fetch(attachment.url);
	const text = await response.text();


	// check and make sure all paragraphs are within the character limit for embed fields
	const verifyParagraphLength = text.split(`\n\n`).map(t => t.length < embedFieldMaxLength);
	if (verifyParagraphLength.includes(false)) {
		return await interaction.editReply(`Paragraphs ${getAllIndexes(verifyParagraphLength, false).map(i => i + 1)} are too long. Each paragraph must be less than ${embedFieldMaxLength} characters.`);
	}

	// get franchise by (A)GM discord id & old brand
	const franchise = await prisma.franchise.findFirst({
		where: {
			OR: [
				{ GM: { Accounts: { some: { providerAccountId: interaction.user.id } } } },
				{ AGM1: { Accounts: { some: { providerAccountId: interaction.user.id } } } },
				{ AGM2: { Accounts: { some: { providerAccountId: interaction.user.id } } } },
				{ AGM3: { Accounts: { some: { providerAccountId: interaction.user.id } } } },
				{ AGM4: { Accounts: { some: { providerAccountId: interaction.user.id } } } },
			]
		},
		include: { Brand: true }
	});

	// --------------------------------------------------------------------------------
	const embedAccentColor = franchise.Brand.colorPrimary ? Number(franchise.Brand.colorPrimary) : 0xE92929;

	const confirmembed = new EmbedBuilder({
		color: embedAccentColor,
		description: `Please confirm that everything looks good below!`
	});

	const descriptionEmbed = new EmbedBuilder({
		color: embedAccentColor,
		thumbnail: { url: `${imagepath}${franchise.logoFileName}?size=1080` },
		footer: { text: `Valorant Draft Circuit - ${franchise.name} (${franchise.slug})`, iconURL: `${imagepath}${franchise.Brand.logo}` }
	});

	const descriptionArray = text.split(`\n`).filter(e => e !== ``);
	descriptionArray.forEach((paragraph) => {
		descriptionEmbed.addFields({ name: `\u200B`, value: paragraph });
	});

	// --------------------------------------------------------------------------------
	// create the action row, add the component to it & then reply with all the data
	const actionrow = new ActionRowBuilder({
		components: [
			new ButtonBuilder({
				customId: `franchise_cancel`,
				label: `Cancel`,
				style: ButtonStyle.Danger,
			}),
			new ButtonBuilder({
				customId: `franchise_descupdate-${franchise.slug}`,
				label: `Update`,
				style: ButtonStyle.Primary,
			})
		]
	});

	// --------------------------------------------------------------------------------

	return await interaction.editReply({
		embeds: [confirmembed, descriptionEmbed],
		components: [actionrow]
	})
}

/** Confirm signing a player
 * @param {ChatInputCommandInteraction} interaction
 */
async function finalizeUpdate(interaction, slug) {

	// get franchise by (A)GM discord id & old brand
	const franchise = await prisma.franchise.findFirst({
		where: { slug: slug },
		include: { Brand: true }
	});

	// --------------------------------------------------------------------------------
	// store the old and new descriptions

	const text = interaction.message.embeds[1].fields.map(f => f.value).join(`\n\n`);
	// store old and new descriptions in cache to send as response
	const oldDescPath = `./cache/old_desc_${franchise.slug}.txt`;
	const newDescPath = `./cache/new_desc_${franchise.slug}.txt`;

	fs.writeFileSync(oldDescPath, franchise.Brand.description);
	fs.writeFileSync(newDescPath, text);

	// --------------------------------------------------------------------------------

	const embed = interaction.message.embeds[0];
	const embedEdits = new EmbedBuilder(embed);
	embedEdits.setDescription(`This operation was successful!`);
	embedEdits.setFields([]);

	// --------------------------------------------------------------------------------

	await prisma.franchiseBrand.update({
		where: { franchise: franchise.id },
		data: { description: text }
	});
	await refreshFranchisesChannel(interaction);
	await interaction.message.edit({
		embeds: [embedEdits],
		components: [],
	});
	return await interaction.editReply({
		content: `The description for ${franchise.name} has been updated & the <#${CHANNELS.FRANCHISES}> channel has been refreshed! Attached are the old & new descriptions.`,
		files: [oldDescPath, newDescPath]
	});
}

module.exports = {
	confirmUpdate: confirmUpdate,
	finalizeUpdate: finalizeUpdate
}