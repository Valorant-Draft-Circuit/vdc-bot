const { ChatInputCommandInteraction } = require(`discord.js`);

const { CHANNELS } = require(`../../../../utils/enums`);
const { prisma } = require(`../../../../prisma/prismadb`);

const fs = require(`fs`);
const Canvas = require('@napi-rs/canvas');
const { Tier } = require('@prisma/client');
const { ControlPanel } = require('../../../../prisma');
const { GlobalFonts } = require('@napi-rs/canvas');


const imagepath = `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/team-logos/`;



const COLORS = {
    PROSPECT: `#FEC335`,
    APPRENTICE: `#72C357`,
    EXPERT: `#04AEE4`,
    MYTHIC: `#A657A6`,

    RED: `#DE3845`,
    WHITE: `#DE3845`,
    GRAY: `#181818`,
    BLACK: `#71C358`,
}
const ASSETS = {
    BASE: `./utils/assets/base.png`,
    LOGO: `./utils/assets/logo.png`,
    topo: `./utils/assets/topography_red.png`,
}



/*  ---------------------------------- SETUP -----------------------------------  */
const setup = {
    /*  -----------------------------------------------------------------------------  */
    pick_x: 600,
    pick_y: 250,

    // pick padding
    x_pp: 2,
    y_pp: 4,
    /*  -----------------------------------------------------------------------------  */

    title_x_perc: 0.06, // percent

    pick_x_padding: 20, // pixels

    pick_y_begin: 0.13,  // percent
    pick_y_padding: 20, // pixels

    pick_slug_padding: 20,
};


async function refreshDraftBoardChannel(/** @type ChatInputCommandInteraction */ interaction) {
    const draftBoardChannel = await interaction.guild.channels.fetch(CHANNELS.DRAFT_BOARD);

    const fetchedMessages = await draftBoardChannel.messages.fetch({ limit: 100 });
    fetchedMessages.map(async (m) => await m.delete());


    GlobalFonts.registerFromPath(`./utils/assets/Lato-Regular.ttf`, `Lato`)

    const dbc = await draftBoardChannel.createWebhook({
        name: 'draftboardupdater',
    });


    const season = await ControlPanel.getSeason();
    const tiers = [Tier.PROSPECT, Tier.APPRENTICE, Tier.EXPERT, Tier.MYTHIC];

    for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];

        const draftboard = await prisma.draft.findMany({
            where: { season: season, tier: tier },
            include: {
                Franchise: { include: { Brand: true } },
                Player: { include: { PrimaryRiotAccount: true } }
            }
        });

        const rounds = Math.max(...draftboard.filter(db => db.round !== 99).map(db => db.round));
        const picks = Math.max(...draftboard.filter(db => db.round === 99).map(db => db.pick));



        const canvas = Canvas.createCanvas(
            setup.pick_x * (picks + setup.x_pp),
            setup.pick_y * (rounds + setup.y_pp)
        );
        const context = canvas.getContext('2d');

        const w = canvas.width;
        const h = canvas.height;

        // solid gray base
        context.fillStyle = COLORS.GRAY;
        context.fillRect(0, 0, w, h);

        // semi trans top
        const base = await Canvas.loadImage(ASSETS.BASE);
        context.globalAlpha = 0.3;
        context.drawImage(base, 0, 0, w, h);
        context.globalAlpha = 1;
        /*  ----------------------------------------------------------------------------  */


        /*  ----------------------------------- TEXT -----------------------------------  */
        context.fillStyle = COLORS[tier];
        context.font = `900 70px Lato`;
        const title = `VALORANT DRAFT CIRCUIT  |  SEASON ${season} ${tier} DRAFT BOARD`
            .split(``).join(` `);
        const titleMeasurements = context.measureText(title)
        context.fillText(
            title,
            (w - titleMeasurements.width) / 2,
            canvas.height * setup.title_x_perc
        );
        /*  ----------------------------------------------------------------------------  */

        // context.fillStyle = COLORS.APPRENTICE;
        // // context.fillRect(0, 0, setup.pick_x, setup.pick_y);
        // context.fillRect(100, 100, 300, 300);
        context.fillStyle = COLORS.APPRENTICE;
        // context.fillRect(100, 300, 300, 300);
        context.fillStyle = COLORS.EXPERT;

        // console.log(rounds)
        let dp = 0;
        for (let i = 0; i < rounds + 1; i++) {
            // for (let i = 0; i < 1; i++) {
            // console.log(i)
            const picksInRound = Math.max(...draftboard.filter(db => rounds != i + 1 ? db.round === 99 : db.round === i + 1).map(db => db.pick));

            // console.log(picksInRound)

            // const pickPadding = picksInRound - 1;

            for (let j = 0; j < picksInRound; j++) {

                // console.log(`${imagepath}${draftboard[dp].Franchise.Brand.logo}`)
                // const franchiseLogo = await Canvas.loadImage(`${imagepath}${draftboard[dp].Franchise.Brand.logo}`);

                const topx = (w - (picksInRound * setup.pick_x + (picksInRound - 1) * setup.pick_x_padding)) / 2 + j * (setup.pick_x + setup.pick_x_padding);
                const topy = setup.pick_y_begin * h + (setup.pick_y_padding + setup.pick_y) * i;


                context.fillStyle = COLORS.GRAY;
                context.globalAlpha = 0.9;
                context.fillRect(
                    topx,
                    topy,
                    setup.pick_x,
                    setup.pick_y
                );
                context.globalAlpha = 1;


                // SLUG
                context.fillStyle = COLORS[tier];
                // context.fillStyle = draftboard[dp].Franchise.Brand.colorPrimary;
                context.font = `900 65px Lato`;
                const slug = draftboard[dp].Franchise.slug;
                const slugMeasurements = context.measureText(slug)

                context.fillText(
                    slug,
                    topx + (setup.pick_x - slugMeasurements.width) / 2,
                    topy + slugMeasurements.actualBoundingBoxAscent + setup.pick_slug_padding * 1.5
                );

                // const sizexy = slugMeasurements.width / (draftboard[dp].Franchise.slug == `CHA` || draftboard[dp].Franchise.slug == `MOX` ? 4 : 2);
                // const logoy = topy + slugMeasurements.actualBoundingBoxAscent + setup.pick_slug_padding * 1.5 - slugMeasurements.width + (slugMeasurements.actualBoundingBoxAscent + sizexy / 2) / 2;
                // context.drawImage( // FRANCHISE LOGO LEFT
                //     franchiseLogo,
                //     (topx + setup.pick_x / 2) - (2 * slugMeasurements.width) - (sizexy / 2),
                //     logoy,
                //     sizexy,
                //     sizexy
                // );

                // context.drawImage( // FRANCHISE LOGO RIGHT
                //     franchiseLogo,
                //     (topx + setup.pick_x / 2) + (2 * slugMeasurements.width) + sizexy + (sizexy / 2),
                //     logoy,
                //     sizexy,
                //     sizexy
                // );

                // PICK DETAILS
                context.fillStyle = COLORS.RED;
                context.font = `900 30px Lato`;
                const pick = `R: ${rounds > i ? i + 1 : `KEEPER`}  |  P: ${j + 1}  |  O: ${dp + 1}  |  K : ${draftboard[dp].keeper}`;
                const pickMeasurements = context.measureText(pick)

                context.fillText(
                    pick,
                    topx + (setup.pick_x - pickMeasurements.width) / 2,
                    topy + pickMeasurements.actualBoundingBoxAscent + slugMeasurements.actualBoundingBoxAscent + (setup.pick_slug_padding * 2.75)
                );

                // draftboard[dp].userID == undefined ? `` : draftboard[dp].Player?.PrimaryRiotAccount.riotIGN
                // PLAYER DETAILS
                context.fillStyle = COLORS.RED;
                context.font = `700 45px Lato`;
                const plyr = draftboard[dp].userID == undefined ? `` : draftboard[dp].Player?.PrimaryRiotAccount.riotIGN;
                // console.log(plyr)
                const plyrMeasurements = context.measureText(plyr)

                context.fillText(
                    plyr,
                    topx + (setup.pick_x - plyrMeasurements.width) / 2,
                    topy + pickMeasurements.actualBoundingBoxAscent + slugMeasurements.actualBoundingBoxAscent + plyrMeasurements.actualBoundingBoxAscent + (setup.pick_slug_padding * 4.5)
                );

                dp++
            }
        }
        const outs = await canvas.encode('png');
        fs.writeFileSync(`./cache/draftboard_${tier}.png`, outs);

        await dbc.send({
            username: `Season ${season} ${tier.charAt(0).toUpperCase() + tier.substring(1).toLowerCase()} Draft Board`,
            avatarURL: `https://uni-objects.nyc3.cdn.digitaloceanspaces.com/vdc/vdc-logos/logo.png`,
            // embeds: [franchiseManagement, teamsEmbed, descriptionEmbed],
            // components: [components]
            files: [`./cache/draftboard_${tier}.png`]
            // content: `poo2p`
        });
    }

    setTimeout(() => dbc.delete(), 30000)
}

module.exports = {
    refreshDraftBoardChannel: refreshDraftBoardChannel
}