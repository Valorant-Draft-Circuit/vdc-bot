const { requestBan, confirmBan } = require("./ban");
const { requestMute, confirmMute } = require("./mute");

module.exports = {
    ban: {
        ban: requestBan,
        confirm: confirmBan
    },
	mute: {
        mute: requestMute,
        confirm: confirmMute
    }
};
