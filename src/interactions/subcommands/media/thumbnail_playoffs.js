const { Team, Franchise } = require(`../../../../prisma`);
const fs = require(`fs`);
const { ChatInputCommandInteraction } = require(`discord.js`);
const logoBaseLink = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos`;
const Canvas = require('@napi-rs/canvas');
const {GlobalFonts} = require('@napi-rs/canvas');
const { LeagueStatus, ContractStatus } = require('@prisma/client');
const { COLORS } = require(`../../../../utils/enums`);

const nameSanatize = (name, slug) => name.split(`#`)[0].replace(`${slug} `, ``);


const ASSETS = {
    BASE: `./utils/assets/base.png`,
    LOGO: `./utils/assets/logo.png`,
};

const params = {
    /*  -------------------- TRANSPARENT FRANCHISE LOGO SETTINGS --------------------  */
    t_fLogo: 0.8,               // how big the logo should be relative to the image size
    t_fLogoCOffset: 0.3,        // how far the logo should be from the L/R edge
    t_fLogoVOffset: 0.5,        // the vertically scaled offset from center
    /*  -----------------------------------------------------------------------------  */

    /*  ---------------------- REGULAR FRANCHISE LOGO SETTINGS ----------------------  */
    r_maxWidth_p: 0.10,         // width of the logo to the canvas width for promo
    r_maxWidth_t: 0.2,          // width of the logo to the canvas width for thumbnail
    r_vertOffset_promo: 0.28,   // how far the logo should be from the top edge
    r_vertOffset_thumb: 0.45,   // how far the logo should be from the top edge
    r_horzOffser_p: 0.34,       // how far the logo should be from the L/R edge for promo
    r_horzOffser_t: 0.24,       // how far the logo should be from the L/R edge for thumbnail
    /*  -----------------------------------------------------------------------------  */


    /*  ------------------------------- TEXT SETTINGS -------------------------------  */
    bestofXVertHeightPercent: 0.12,
    titleVertHeightPercent: 0.88,
    centerRosterOffset: 0.085,            // half of the main canvas multiplier
    rosterFirstPlayerHeightPercent: 0.475,
    /*  -----------------------------------------------------------------------------  */
};


async function generatePlayoffsImages(
    /** @type ChatInputCommandInteraction */ interaction,
    /** @type Object */ options,
) {

    const { homeName, awayName, resolution, time, type, style } = options;
    
    const homeTeam = await Team.getBy({ name: homeName });
    const awayTeam = await Team.getBy({ name: awayName });
    const tier = homeTeam.tier;

    // console.log(await Team.getRosterBy({ name: homeName }))
    // get roster
    const homeRoster = (await Team.getRosterBy({ name: homeName })).roster
        .filter(p => (p.Status.leagueStatus === LeagueStatus.SIGNED || p.Status.leagueStatus === LeagueStatus.GENERAL_MANAGER) && p.Status.contractStatus !== ContractStatus.INACTIVE_RESERVE)
        .map(p => nameSanatize(p.PrimaryRiotAccount.riotIGN, homeTeam.Franchise.slug));
    const awayRoster = (await Team.getRosterBy({ name: awayName })).roster
        .filter(p => (p.Status.leagueStatus === LeagueStatus.SIGNED || p.Status.leagueStatus === LeagueStatus.GENERAL_MANAGER) && p.Status.contractStatus !== ContractStatus.INACTIVE_RESERVE)
        .map(p => nameSanatize(p.PrimaryRiotAccount.riotIGN, awayTeam.Franchise.slug));
    /*  ----------------------------------------------------------------------------  */


    /*  -------------------------- CREATE BACKGROUND BASE --------------------------  */
    const width = resolution === `1080P` ? 1920 : 3840;
    const length = resolution === `1080P` ? 1080 : 2160;
    const canvas = Canvas.createCanvas(width, length);
    const context = canvas.getContext('2d');

    GlobalFonts.registerFromPath(`./utils/assets/Komu-A.ttf`, `Komu`)
    GlobalFonts.registerFromPath(`./utils/assets/Lato-Regular.ttf`, `Lato`)

    const topographyBKG = await Canvas.loadImage(`./utils/assets/topography_red.png`);
    context.drawImage(topographyBKG, 0, 0, width, length);
    const gradient = context.createLinearGradient(0, 0, width, 0);

    const gradientOffset = 0.3;
    gradient.addColorStop(0, COLORS.GRAY);
    gradient.addColorStop(0.5 - gradientOffset, COLORS.GRAY);
    gradient.addColorStop(0.5, `transparent`);
    gradient.addColorStop(0.5 + gradientOffset, COLORS.GRAY);
    gradient.addColorStop(1.0, COLORS.GRAY);

    // Fill with gradient
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    /*  ----------------------------------------------------------------------------  */


    /*  -------------------------- PLACEMENT CALCULATIONS --------------------------  */
    // HOME LOGO
    const homeLogo = await Canvas.loadImage(`${logoBaseLink}/${homeTeam.Franchise.Brand.logo}`);
    const homeRGScale = homeLogo.width / ((type === `promo` ? params.r_maxWidth_p : params.r_maxWidth_t) * canvas.width);

    // AWAY LOGO
    const awayLogo = await Canvas.loadImage(`${logoBaseLink}/${awayTeam.Franchise.Brand.logo}`);
    const awayRGScale = awayLogo.width / ((type === `promo` ? params.r_maxWidth_p : params.r_maxWidth_t) * canvas.width);

    const settings = {
        width: width,
        length: length,

        // HOME LOGO CALCULATIONS
        home: {
            bgLogo: {
                x: - ((homeLogo.width * ((canvas.height * params.t_fLogo) / homeLogo.height)) / 2) + (params.t_fLogoCOffset * ((homeLogo.width * ((canvas.height * params.t_fLogo) / homeLogo.height)) / 2)),
                y: (canvas.height - params.t_fLogo * canvas.height) / 2,
                l: homeLogo.width * ((canvas.height * params.t_fLogo) / homeLogo.height),
                h: canvas.height * params.t_fLogo,
            },
            rgLogo: {
                x: type === `promo` ?
                    params.r_horzOffser_p * canvas.width :
                    params.r_horzOffser_t * canvas.width,
                y: (type === `promo` ?
                    params.r_vertOffset_promo :
                    params.r_vertOffset_thumb) * canvas.height - (homeLogo.height / (2 * homeRGScale)),
                l: (type === `promo` ? params.r_maxWidth_p : params.r_maxWidth_t) * canvas.width,
                h: homeLogo.height / homeRGScale,
            }
        },

        // AWAY LOGO CALCULATIONS
        away: {
            bgLogo: {
                x: canvas.width - ((awayLogo.width * ((canvas.height * params.t_fLogo) / awayLogo.height)) / 2) - (params.t_fLogoCOffset * ((awayLogo.width * ((canvas.height * params.t_fLogo) / awayLogo.height)) / 2)),
                y: (canvas.height - params.t_fLogo * canvas.height) / 2,
                l: awayLogo.width * ((canvas.height * params.t_fLogo) / awayLogo.height),
                h: canvas.height * params.t_fLogo,
            },
            rgLogo: {
                x: type === `promo` ?
                    canvas.width - params.r_horzOffser_t * canvas.width - params.r_maxWidth_t * canvas.width :
                    (canvas.width - params.r_horzOffser_t * canvas.width - params.r_maxWidth_p * canvas.width - (awayLogo.width / (2 * awayRGScale))),
                y: (type === `promo` ?
                    params.r_vertOffset_promo :
                    params.r_vertOffset_thumb) * canvas.height - (awayLogo.height / (2 * awayRGScale)),
                l: (type === `promo` ? params.r_maxWidth_p : params.r_maxWidth_t) * canvas.width,
                h: awayLogo.height / awayRGScale,
            }
        }
    };
    /*  ----------------------------------------------------------------------------  */


    /*  ----------------------------------- LOGOS ----------------------------------  */
    context.globalAlpha = 0.35;
    context.drawImage( // HOME LOGO
        homeLogo,
        settings.home.bgLogo.x,
        settings.home.bgLogo.y,
        settings.home.bgLogo.l,
        settings.home.bgLogo.h
    );
    context.drawImage( // AWAY LOGO
        awayLogo,
        settings.away.bgLogo.x,
        settings.away.bgLogo.y,
        settings.away.bgLogo.l,
        settings.away.bgLogo.h,
    );
    context.globalAlpha = 1;

    context.drawImage( // HOME LOGO
        homeLogo,
        settings.home.rgLogo.x,
        settings.home.rgLogo.y,
        settings.home.rgLogo.l,
        settings.home.rgLogo.h
    );
    context.drawImage( // AWAY LOGO
        awayLogo,
        settings.away.rgLogo.x,
        settings.away.rgLogo.y,
        settings.away.rgLogo.l,
        settings.away.rgLogo.h
    );
    /*  ----------------------------------------------------------------------------  */


    /*  ----------------------------------- TEXT -----------------------------------  */
    context.fillStyle = COLORS.RED;
    context.font = `700 35px Lato`;
    const boXtext = `Best of ${style === `grand-finals` ? 5 : 3} Series  |  ${time}`.toUpperCase().split(``).join(` `);
    const boXtextMeasurements = context.measureText(boXtext)
    context.fillText(
        boXtext,
        (canvas.width - boXtextMeasurements.width) / 2,
        canvas.height * params.bestofXVertHeightPercent
    );

    context.font = `45px Komu`;
    const vsText = `vs`;
    const vsTextMeasurements = context.measureText(vsText)
    context.fillText(
        vsText,
        (canvas.width - vsTextMeasurements.width) / 2,
        (style === `promo` ? params.r_vertOffset_promo : params.r_vertOffset_thumb) * canvas.height + vsTextMeasurements.actualBoundingBoxAscent / 2
    );

    context.font = `100px Komu`;
    const VDC_SHORT = `Valorant Draft Circuit`.split(``).join(` `);
    const shortMeasurements = context.measureText(VDC_SHORT)
    context.fillText(
        VDC_SHORT,
        (canvas.width - shortMeasurements.width) / 2,
        canvas.height * params.titleVertHeightPercent
    );

    context.fillStyle = COLORS[tier];
    context.font = `900 40px Lato`;
    const subtitle = `${tier} ${style.replace(`-`, ` `)}`.toUpperCase().split(``).join(` `);;
    const subtitleMeasurements = context.measureText(subtitle)
    context.fillText(
        subtitle,
        (canvas.width - subtitleMeasurements.width) / 2,
        canvas.height - ((subtitleMeasurements.actualBoundingBoxAscent) + (subtitleMeasurements.actualBoundingBoxAscent - subtitleMeasurements.actualBoundingBoxAscent) / 2) * 0.8 - 40
    );

    if (type === `promo`) {
        context.font = `700 45px Lato`;
        const rosterAlign = (player, i, side) => {
            const playerTextMeasurement = context.measureText(player);
            const xPos = side === `L` ?
                (1 - params.centerRosterOffset) * (canvas.width / 2) - playerTextMeasurement.width :
                (1 + params.centerRosterOffset) * (canvas.width / 2);
            context.fillText(
                player,
                xPos,
                canvas.height * params.rosterFirstPlayerHeightPercent + i * 60
            );
        }
        for (let i = 0; i < 5; i++) {
            console.log(homeRoster[i])
            rosterAlign(homeRoster[i], i, `L`);
            rosterAlign(awayRoster[i], i, `R`);
        }
    }
    /*  ----------------------------------------------------------------------------  */


    /*  ---------------------------------- EXPORT ----------------------------------  */
    const image = await canvas.encode('png');
    fs.writeFileSync(`./cache/playoffs.png`, image)
    /*  ----------------------------------------------------------------------------  */
    interaction.editReply({ files: [`./cache/playoffs.png`] });
}

module.exports = { generatePlayoffsImages };