const { joinQueue } = require(`./join`);
const { leaveQueue } = require(`./leave`);
const { handleAdminCommand } = require(`./admin`);
const { status } = require(`./status`);

module.exports = {
	joinQueue,
	leaveQueue,
	handleAdminCommand,
	status,
};
