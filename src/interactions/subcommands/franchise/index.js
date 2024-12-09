const { info } = require(`./info`);
const { confirmUpdate, finalizeUpdate } = require(`./updateDescription`);

module.exports = {
    info: info,
    updateDescription: {
        confirm: confirmUpdate,
        finalize: finalizeUpdate,
    }
};
