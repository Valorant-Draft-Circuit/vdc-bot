const getAllFranchises = require(`./getAllFranchises`);
const getFranchiseFromSlug = require(`./getFranchiseFromSlug`);
const getFranchiseFromTeamName = require(`./getFranchiseFromTeamName`);
const getTeamsFromSlug = require(`./getTeamsFromSlug`);
const getPlayerStatsByDiscordId = require(`./getPlayerStatsByDiscordId`);
const getTeamsFromFranchiseName = require(`./getTeamsFromFranchiseName`);
const getPlayersOnTeamFromName = require(`./getPlayersOnTeamFromName`);
const getSubList = require(`./getSubList`);


const setPlayer = require(`./setPlayer`);


module.exports = {
    getAllFranchises: getAllFranchises,
    getFranchiseFromSlug: getFranchiseFromSlug,
    getFranchiseFromTeamName: getFranchiseFromTeamName,
    getTeamsFromSlug: getTeamsFromSlug,
    getPlayerStatsByDiscordId: getPlayerStatsByDiscordId,
    getTeamsFromFranchiseName: getTeamsFromFranchiseName,

    setPlayer: setPlayer,
    getSubList: getSubList,
    getPlayersOnTeamFromName: getPlayersOnTeamFromName,
}