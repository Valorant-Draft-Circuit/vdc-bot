const { Team, Franchise } = require(`../../../../prisma`);
const fs = require(`fs`);
const { ChatInputCommandInteraction } = require(`discord.js`);
const logoBaseLink = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos`;
const { GlobalFonts } = require('@napi-rs/canvas');
const Canvas = require('@napi-rs/canvas');
const { COLORS } = require(`../../../../utils/enums`);

const ASSETS = {
    BASE: `./utils/assets/base.png`,
    LOGO: `./utils/assets/logo.png`,
};

const settings = {
    franchiseLogoMaxWidth: 300,
    franchiseLogoVertPercent: 28, // percentage from top to bottom
    franchiseLogoMargin: 700,
    titleVertHeightPercent: 68,
    subtitleVerticalHeightPercent: 55,

    logoScale: 25,
    logoVertHeightPercent: 75,
};


async function generateSeasonThumbnail(
    /** @type ChatInputCommandInteraction */ interaction,
    /** @type String */ homeTeam,
    /** @type String */ awayTeam,
    /** @type Number */ day,
    /** @type String */ time
) {

    GlobalFonts.registerFromPath(`./utils/assets/Komu-A.ttf`, `Komu`)
    GlobalFonts.registerFromPath(`./utils/assets/Lato-Regular.ttf`, `Lato`)

    const resolution = `1080P`;

    const homeFranchise = await Franchise.getBy({ teamName: homeTeam });
    const awayFranchise = await Franchise.getBy({ teamName: awayTeam });
    const tier = (await Team.getBy({ name: homeTeam })).tier;

    // load assets
    const logo = await Canvas.loadImage(ASSETS.LOGO);
    const homeLogo = await Canvas.loadImage(`${logoBaseLink}/${homeFranchise.Brand.logo}`);
    const awayLogo = await Canvas.loadImage(`${logoBaseLink}/${awayFranchise.Brand.logo}`);

    const homeScale = homeLogo.width / settings.franchiseLogoMaxWidth;
    const awayScale = awayLogo.width / settings.franchiseLogoMaxWidth;


    const processingParamaters = {
        thumbnailWidth: resolution === `1080P` ? 1920 : 3840,
        thumbnailLength: resolution === `1080P` ? 1080 : 2160,

        homeParams: {
            scale: homeScale,
            height: Math.round(homeLogo.height / (homeScale)),
            width: settings.franchiseLogoMaxWidth,
            horzPlacement: settings.franchiseLogoMargin - (settings.franchiseLogoMaxWidth / 2),
            vertPlacement: (settings.franchiseLogoVertPercent / 100) * (resolution === `1080P` ? 1080 : 2160) - Math.round(homeLogo.height / (homeScale) / 2),
        },

        awayParams: {
            scale: awayScale,
            height: Math.round(awayLogo.height / (awayScale)),
            width: settings.franchiseLogoMaxWidth,
            horzPlacement: (resolution === `1080P` ? 1920 : 3840) - settings.franchiseLogoMargin - (settings.franchiseLogoMaxWidth / 2),
            vertPlacement: (settings.franchiseLogoVertPercent / 100) * (resolution === `1080P` ? 1080 : 2160) - Math.round(awayLogo.height / (awayScale) / 2),
        },
    };

    // Begin Generation
    const canvas = Canvas.createCanvas(processingParamaters.thumbnailWidth, processingParamaters.thumbnailLength);
    const context = canvas.getContext('2d');

    // background
    context.fillStyle = COLORS.GRAY;
    context.fillRect(0, 0, canvas.width, canvas.height);


    const logowidth = logo.width * (settings.logoScale / 100)
    context.drawImage(
        logo,
        (canvas.width - logowidth) / 2,
        canvas.height * (settings.logoVertHeightPercent / 100),
        logowidth, logo.height * (settings.logoScale / 100)
    );


    // VDC Text #################################
    context.font = `250px Komu`;
    context.fillStyle = COLORS.RED;

    const VDC_LONG = `Valorant Draft Circuit`.split(``).join(` `);

    const textMeasurements = context.measureText(VDC_LONG)
    context.globalAlpha = 0.08;

    context.fillText(
        VDC_LONG,
        (canvas.width - textMeasurements.width) / 2,
        canvas.height * ((settings.titleVertHeightPercent) / 100) + textMeasurements.actualBoundingBoxAscent / 4
    );
    context.globalAlpha = 1;

    context.font = `120px Komu`;
    const VDC_SHORT = `Valorant Draft Circuit`.split(``).join(` `);

    const shortMeasurements = context.measureText(VDC_SHORT)
    context.fillText(VDC_SHORT,
        (canvas.width - shortMeasurements.width) / 2,
        canvas.height * (settings.titleVertHeightPercent / 100)
    );
    // ##########################################

    // subtitle ############################
    context.font = `45px Komu`;
    context.fillStyle = COLORS[tier];

    const subtitle = `${tier}     |     MATCH DAY ${day}     |     ${time}`;

    const subtitleMeasurements = context.measureText(subtitle)
    context.fillText(subtitle,
        (canvas.width - subtitleMeasurements.width) / 2,
        canvas.height * (settings.subtitleVerticalHeightPercent / 100)
    );
    // ##########################################

    // vs ############################
    context.font = `45px Komu`;
    context.fillStyle = COLORS.RED;

    const vsText = `vs`;

    const vsTextMeasurements = context.measureText(vsText)
    context.fillText(vsText,
        (canvas.width - vsTextMeasurements.width) / 2,
        canvas.height * (settings.franchiseLogoVertPercent / 100) + 25
    );
    // ##########################################

    // Logo Plcement ############################
    context.drawImage(homeLogo,
        processingParamaters.homeParams.horzPlacement,
        processingParamaters.homeParams.vertPlacement,
        processingParamaters.homeParams.width,
        processingParamaters.homeParams.height
    );
    context.drawImage(awayLogo,
        processingParamaters.awayParams.horzPlacement,
        processingParamaters.awayParams.vertPlacement,
        processingParamaters.awayParams.width,
        processingParamaters.awayParams.height
    );
    // ##########################################

    // Assign the decided font to the canvas
    context.font = `40px Komu`;
    context.fillStyle = COLORS[tier.toUpperCase()];

    const gradient = context.createLinearGradient(0, 0, 1920, 1080);
    context.font = `300px Komu`;

    gradient.addColorStop(0, `transparent`);
    gradient.addColorStop(0.5, `blue`);
    gradient.addColorStop(1.0, "transparent");

    // Fill with gradient
    context.fillStyle = gradient;

    // Use the helpful Attachment class structure to process the file
    const expimg = await canvas.encode('png');
    fs.writeFileSync(`./cache/season.png`, expimg);
    interaction.editReply({ files: [`./cache/season.png`] });
}

module.exports = { generateSeasonThumbnail };