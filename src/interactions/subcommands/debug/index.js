const { debugUser } = require(`./user`);
const { report } = require(`./report`);
const { forceUpdate } = require("./force_update");

module.exports = {
    debugUser: debugUser,
    debugLeagueStatus: report,
    forceUpdate: forceUpdate,
}