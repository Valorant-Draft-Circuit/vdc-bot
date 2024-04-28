const { debugUser } = require(`./user`);
const { report } = require(`./report`);
const { forceUpdate } = require("./force_update");
const { processInactive } = require("./processInactive");


module.exports = {
    debugUser: debugUser,
    debugLeagueStatus: report,
    forceUpdate: forceUpdate,
    processInactive: processInactive,
}