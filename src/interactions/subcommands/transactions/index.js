const { requestSign, confirmSign } = require(`./sign`);
const { requestCut, confirmCut } = require(`./cut`);
const { requestUpdateTier, confirmUpdateTier } = require(`./updateTier`);
const { requestRenew, confirmRenew } = require(`./renew`);
const { requestExpire, confirmExpire } = require(`./expire`);
const { requestSub, confirmSub } = require(`./sub`);
const { requestUnsub, confirmUnsub } = require(`./unsub`);
const { requestIR, confirmToggleIR } = require(`./ir`);
const { requestCaptain, confirmToggleCaptain } = require(`./captain`);
const { requestRetire, confirmRetire } = require(`./retire`);
const { requestTrade, resetTrade, confirmTrade, displayFranchiseTradeOptions, playerTradeRequest, draftPickTradeRequest } = require(`./trade`);

module.exports = {
	sign: {
		sign: requestSign,
		confirm: confirmSign,
	},
	cut: {
		cut: requestCut,
		confirm: confirmCut,
	},
	updateTier: {
		updateTier: requestUpdateTier,
		confirm: confirmUpdateTier,
	},
	renew: {
		renew: requestRenew,
		confirm: confirmRenew,
	},
	expire: {
		expire: requestExpire,
		confirm: confirmExpire,
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
	captain: {
		captain: requestCaptain,
		confirm: confirmToggleCaptain,
	},
	retire: {
		retire: requestRetire,
		confirm: confirmRetire,
	},
	trade: {
		trade: requestTrade,
		reset: resetTrade,
		confirm: confirmTrade,
		displayFranchiseTradeOptions: displayFranchiseTradeOptions,

		playerTradeRequest: playerTradeRequest,
		draftPickTradeRequest: draftPickTradeRequest,
	},
};
