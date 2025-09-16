const { generatePlayoffsImages } = require("./thumbnail_playoffs");
const { generateSeasonThumbnail } = require(`./thumbnail_season`);
const { statsCsv } = require(`./stats_csv`);

module.exports = {
    generateSeasonThumbnail: generateSeasonThumbnail,
    generatePlayoffsImages: generatePlayoffsImages,
    statsCsv: statsCsv,
}