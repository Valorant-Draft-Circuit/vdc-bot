const { debugUser } = require(`./user`);
const { report } = require(`./report`);
const { forceUpdate } = require("./force_update");
const { processInactive } = require("./processInactive");
const { updateMMR } = require("./updateMMR");
const { updateByIGN } = require("./updateByIGN");
const { processRFA } = require("./processRFA");
const { profileUpdate } = require("./profileUpdate");
const { refreshCache } = require("./refreshCache");
const { profileUpdateServer } = require("./profileUpdateServer");


module.exports = {
    debugUser: debugUser,
    debugLeagueStatus: report,
    forceUpdate: forceUpdate,
    processInactive: processInactive,
    processRFA: processRFA,
    updateMMR: updateMMR,
    updateByIGN: updateByIGN,
    profileUpdate: profileUpdate,
    refreshCache: refreshCache,
    profileUpdateServer: profileUpdateServer,
}