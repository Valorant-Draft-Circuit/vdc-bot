const { generatePlayoffsImages } = require("./thumbnail_playoffs");
const { generateSeasonThumbnail } = require(`./thumbnail_season`);

module.exports = {
    generateSeasonThumbnail: generateSeasonThumbnail,
    generatePlayoffsImages: generatePlayoffsImages
}