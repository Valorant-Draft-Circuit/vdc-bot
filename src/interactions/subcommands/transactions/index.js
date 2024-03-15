const { requestSign, confirmSign } = require(`./sign`);
const { requestCut, confirmCut } = require(`./cut`);

module.exports = {
    sign : {
        sign: requestSign,
        confirm: confirmSign
    },
    cut: {

    },
}