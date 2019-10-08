"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const validator_1 = __importDefault(require("./validator"));
const response_1 = __importDefault(require("../common/response"));
const code_1 = __importDefault(require("../common/code"));
const formatter_1 = require("../common/formatter");
const ethereumjs_util_1 = require("ethereumjs-util");
const ethereumjs_tx_1 = __importDefault(require("ethereumjs-tx"));
/**
 * @description sign hash
 * @param web3
 * @param account
 * @param hash
 * @returns {Promise.<*>}
 */
function sign(web3, account, hash) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            validator_1.default.validate({ value: account, type: "ETH_ADDRESS" });
        }
        catch (e) {
            return Promise.resolve(new response_1.default(code_1.default.PARAM_INVALID.code, code_1.default.PARAM_INVALID.msg));
        }
        return new Promise(resolve => {
            web3.eth.sign(account, hash, function (err, result) {
                if (!err) {
                    const r = result.slice(0, 66);
                    const s = formatter_1.addHexPrefix(result.slice(66, 130));
                    const v = formatter_1.toNumber(formatter_1.addHexPrefix(result.slice(130, 132)));
                    resolve({ result: { r, s, v } });
                }
                else {
                    const errorMsg = err.message.substring(0, err.message.indexOf(" at "));
                    resolve({ error: { message: errorMsg } });
                }
            });
        });
    });
}
exports.sign = sign;
/**
 * @description sign message
 * @param web3
 * @param account
 * @param message
 * @returns {Promise}
 */
function signMessage(web3, account, message) {
    const hash = formatter_1.toHex(ethereumjs_util_1.hashPersonalMessage(ethereumjs_util_1.sha3(message)));
    return sign(web3, account, hash);
}
exports.signMessage = signMessage;
/**
 * @description Signs ethereum tx
 * @param web3
 * @param account
 * @param rawTx
 * @returns {Promise.<*>}
 */
function signEthereumTx(web3, account, rawTx) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            validator_1.default.validate({ value: rawTx, type: "TX" });
        }
        catch (e) {
            return Promise.resolve(new response_1.default(code_1.default.PARAM_INVALID.code, code_1.default.PARAM_INVALID.msg));
        }
        try {
            const ethTx = new ethereumjs_tx_1.default(rawTx);
            const hash = formatter_1.toHex(ethTx.hash(false));
            const response = yield sign(web3, account, hash);
            if (!response["error"]) {
                const signature = response["result"];
                signature.v += ethTx._chainId * 2 + 8;
                Object.assign(ethTx, signature);
                return { result: formatter_1.toHex(ethTx.serialize()) };
            }
            else {
                return response;
            }
        }
        catch (e) {
            console.log("Failed to sign EthereumTx");
            console.log(e);
            return e;
        }
    });
}
exports.signEthereumTx = signEthereumTx;
/**
 * @description Sends ethereum tx through MetaMask
 * @param web3
 * @param tx
 * @returns {*}
 */
function sendTransaction(web3, tx) {
    try {
        validator_1.default.validate({ type: "TX", value: tx });
    }
    catch (e) {
        return Promise.resolve(new response_1.default(code_1.default.PARAM_INVALID.code, code_1.default.PARAM_INVALID.msg));
    }
    return new Promise(resolve => {
        web3.eth.sendTransaction(tx, function (err, transactionHash) {
            if (!err) {
                resolve({ result: transactionHash });
            }
            else {
                const errorMsg = err.message.substring(0, err.message.indexOf(" at "));
                resolve({ error: { message: errorMsg } });
            }
        });
    });
}
exports.sendTransaction = sendTransaction;
//# sourceMappingURL=metaMask.js.map