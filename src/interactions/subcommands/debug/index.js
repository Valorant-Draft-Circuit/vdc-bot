const { debugUser } = require(`./user`);
const { report } = require(`./report`);

module.exports = {
    debugUser: debugUser,
    debugLeagueStatus: report,
}