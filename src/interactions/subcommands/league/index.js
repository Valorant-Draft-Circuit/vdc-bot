const { updateFranchiseManagement } = require("./updateFranchiseManagement");
const { refreshFranchisesChannel } = require("./refreshFranchisesChannel");
const { modifyAccolades } = require("./modifyAccolades");
const { requestAwardFinal, confirmAwardFinal } = require("./awardChampionship");
const { requestAwardPickems, confirmAwardPickems } = require("./awardPickems");

module.exports = {
    modifyAccolades: modifyAccolades,
    updateFranchiseManagement: updateFranchiseManagement,
    refreshFranchisesChannel: refreshFranchisesChannel,
    requestAwardFinal: requestAwardFinal,
    confirmAwardFinal: confirmAwardFinal,
    requestAwardPickems: requestAwardPickems,
    confirmAwardPickems: confirmAwardPickems
}