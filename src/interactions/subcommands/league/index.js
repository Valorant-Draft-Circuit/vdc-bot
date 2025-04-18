const { updateFranchiseManagement } = require("./updateFranchiseManagement");
const { refreshFranchisesChannel } = require("./refreshFranchisesChannel");
const { modifyAccolades } = require("./modifyAccolades");

module.exports = {
    modifyAccolades: modifyAccolades,
    updateFranchiseManagement: updateFranchiseManagement,
    refreshFranchisesChannel: refreshFranchisesChannel
}