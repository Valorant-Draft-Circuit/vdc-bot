const { debugUser } = require(`./user`);
const { forceUpdate } = require("./force_update");
const { processInactive } = require("./processInactive");
const { updateMMR } = require("./updateMMR");
const { updateByIGN } = require("./updateByIGN");
const { processRFA } = require("./processRFA");
const { profileUpdate } = require("./profileUpdate");
const { refreshCache } = require("./refreshCache");
const { profileUpdateServer } = require("./profileUpdateServer");
const { offseasonReset } = require("./offseasonReset");


module.exports = {
    debugUser: debugUser,
    forceUpdate: forceUpdate,
    processInactive: processInactive,
    processRFA: processRFA,
    updateMMR: updateMMR,
    updateByIGN: updateByIGN,
    profileUpdate: profileUpdate,
    refreshCache: refreshCache,
    profileUpdateServer: profileUpdateServer,
    offseasonReset: offseasonReset,
}