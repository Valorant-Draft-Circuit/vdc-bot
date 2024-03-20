const { requestSign, confirmSign } = require(`./sign`);
const { requestCut, confirmCut } = require(`./cut`);
const { requestDraftSign, confirmDraftSign } = require("./draftSign");
const { requestUpdateTier, confirmUpdateTier } = require("./updateTier");
const { requestRenew, confirmRenew } = require("./renew");
const { requestSub, confirmSub } = require("./sub");
const { requestUnsub, confirmUnsub } = require("./unSub");
const { requestIR, confirmSetIR, confirmRemoveIR } = require("./IR");
const { requestSwap, confirmSwap } = require("./swap");
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
    confirmSet: confirmSetIR,
    confirmRemove: confirmRemoveIR,
  },
  swap: {
    swap: requestSwap,
    confirm: confirmSwap,
  },
  retire: {
    retire: requestRetire,
    confirm: confirmRetire,
  },
};
