const { debugUser } = require(`./user`);
const { report } = require(`./report`);
const { forceUpdate } = require("./force_update");
const { processInactive } = require("./processInactive");
const { updateMMR } = require("./updateMMR");
const { updateByIGN } = require("./updateByIGN");


module.exports = {
    debugUser: debugUser,
    debugLeagueStatus: report,
    forceUpdate: forceUpdate,
    processInactive: processInactive,
    updateMMR: updateMMR,
    updateByIGN: updateByIGN,
}