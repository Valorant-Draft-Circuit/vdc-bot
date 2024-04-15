const { requestSign, confirmSign } = require(`./sign`);
const { requestCut, confirmCut } = require(`./cut`);
const { requestDraftSign, confirmDraftSign } = require("./draftSign");
const { requestUpdateTier, confirmUpdateTier } = require("./updateTier");
const { requestRenew, confirmRenew } = require("./renew");
const { requestSub, confirmSub } = require("./sub");
const { requestUnsub, confirmUnsub } = require("./unsub");
const { requestIR, confirmToggleIR } = require("./ir");
const { requestRetire, confirmRetire } = require("./retire");

module.exports = {
	sign: {
		sign: requestSign,
		confirm: confirmSign,
	},
	cut: {
		cut: requestCut,
		confirm: confirmCut,
	},
	draftSign: {
		draftSign: requestDraftSign,
		confirm: confirmDraftSign,
	},
	updateTier: {
		updateTier: requestUpdateTier,
		confirm: confirmUpdateTier,
	},
	renew: {
		renew: requestRenew,
		confirm: confirmRenew,
	},
	sub: {
		sub: requestSub,
		confirm: confirmSub,
	},
	unsub: {
		unsub: requestUnsub,
		confirm: confirmUnsub,
	},
	ir: {
		ir: requestIR,
		confirm: confirmToggleIR,
	},
	retire: {
		retire: requestRetire,
		confirm: confirmRetire,
	},
};
