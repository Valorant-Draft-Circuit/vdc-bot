"use strict";
/**
 * @instructions
 * To compile this file, type in the following command into the root of the project directory
 * tsc ./utils/enums/transactions.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionsCutOptions = exports.TransactionsSubTypes = void 0;
/**
 * @enum {TransactionsSubTypes} Enumerations for the sub commands
 */
var TransactionsSubTypes;
(function (TransactionsSubTypes) {
    /** @param {Number} FRANCHISE - Franchise enumeration */
    TransactionsSubTypes[TransactionsSubTypes["FRANCHISE"] = 101] = "FRANCHISE";
    /** @param {Number} TEAM - Team enumeration */
    TransactionsSubTypes[TransactionsSubTypes["TEAM"] = 102] = "TEAM";
    /** @param {Number} PLAYER - Player enumeration */
    TransactionsSubTypes[TransactionsSubTypes["PLAYER"] = 103] = "PLAYER";
})(TransactionsSubTypes || (exports.TransactionsSubTypes = TransactionsSubTypes = {}));
/**
 * @enum {TransactionsSubTypes} - Enumerations for the cut commands
 */
var TransactionsCutOptions;
(function (TransactionsCutOptions) {
    /** @param {enum} CONFIRM - Confirm cut enumeration */
    TransactionsCutOptions[TransactionsCutOptions["CONFIRM"] = 201] = "CONFIRM";
    /** @param {enum} CANCEL - Cancel cut enumeration */
    TransactionsCutOptions[TransactionsCutOptions["CANCEL"] = 202] = "CANCEL";
})(TransactionsCutOptions || (exports.TransactionsCutOptions = TransactionsCutOptions = {}));
