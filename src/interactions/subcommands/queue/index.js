const { joinQueue } = require(`./join`);
const { leaveQueue } = require(`./leave`);
const { handleAdminCommand } = require(`./admin`);

module.exports = {
	joinQueue,
	leaveQueue,
	handleAdminCommand,
};
