const { awardCompPicks } = require("./awardCompPicks");
const { draftPlayer } = require("./draftPlayer");
const { fulfillFutureTrade } = require("./fulfillFutureTrade");
const { generateLottery } = require("./generateLottery");
const { releaseOfflineDraftResults } = require("./releaseOfflineDraftResults");
const { resetKeeperPick } = require("./resetKeeperPick");
const { setKeeperPick } = require("./setKeeperPick");
const { viewTierDraftBoard } = require("./viewDraftBoard");

module.exports = {
    generateLottery: generateLottery,
    awardCompPicks: awardCompPicks,
    fulfillFutureTrade: fulfillFutureTrade,
    viewTierDraftBoard: viewTierDraftBoard,
    setKeeperPick: setKeeperPick,
    resetKeeperPick: resetKeeperPick,
    draftPlayer: draftPlayer,
    releaseOfflineDraftResults: releaseOfflineDraftResults
}