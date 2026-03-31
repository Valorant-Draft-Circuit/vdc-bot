const queueconfig = require(`./queueconfig`);
const bootstrap = require(`./bootstrap`);
const health = require(`./health`);
const matchLifecycle = require(`./matchLifecycle`);
const id = require(`../../helpers/queue/id`);
const matchChannels = require(`./matchChannels`);
const queueState = require(`../../helpers/queue/queueState`);
const queueKeys = require(`../../helpers/queue/queueKeys`);
const timeToClose = require(`./timeToClose`);
const runtime = require(`./runtime`);

module.exports = {
	...queueconfig,
	...bootstrap,
	...health,
	...matchLifecycle,
	...id,
	...matchChannels,
	...queueState,
	...queueKeys,
	...timeToClose,
	...runtime,
};
