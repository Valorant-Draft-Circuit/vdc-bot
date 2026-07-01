const { Transaction } = require(`../../../prisma`);
const Logger = require(`../../core/logger`);

const logger = new Logger();

/** Writes to transaction history row. This never throws: by the time it
 * runs the roster mutation has already committed, so a logging failure must not surface
 * to the user or block the announcement. Callers supply only the six transaction columns
 * (the current season is resolved inside Transaction.log). */
async function logTransaction(options) {
	try {
		await Transaction.log(options);
	} catch (error) {
		logger.log(`WARNING`, `Failed to record ${options.type} transaction: ${error.message}`);
	}
}

module.exports = { logTransaction };
