"use strict";
// FIXME: abi file is not included in project.
// import {generateAbiData} from './abi';
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
const transaction_1 = __importDefault(require("./transaction"));
const request_1 = __importDefault(require("../common/request"));
const formatter_1 = require("../common/formatter");
var ethereumjs_abi = require("ethereumjs-abi");
// HACK: What is the host in wallet/token?
const host = "host";
class Token {
    constructor(input) {
        validator_1.default.validate({ value: input, type: "BASIC_TOKEN" });
        this.address = input.address;
        this.symbol = input.symbol || "";
        this.name = input.name || "";
        this.digits = input.digits;
        this.unit = input.unit || "";
        if (input.website) {
            this.website = input.website;
        }
        this.allowance = input.allowance || 10000;
        this.precision = input.precision || 6;
        this.minTradeValue = input.minTradeValue || 0.0001;
    }
    generateTransferTx({ to, amount, gasPrice, gasLimit, nonce, chainId }) {
        validator_1.default.validate({ value: amount, type: "ETH_DATA" });
        const tx = {};
        tx["to"] = this.address;
        tx["value"] = "0x0";
        // tx['data'] = generateAbiData({method: "transfer", address: to, amount});
        if (gasPrice) {
            tx["gasPrice"] = gasPrice;
        }
        if (gasLimit) {
            tx["gasLimit"] = gasLimit;
        }
        if (nonce) {
            tx["nonce"] = nonce;
        }
        if (chainId) {
            tx["chainId"] = chainId;
        }
        return tx;
    }
    generateApproveTx({ spender, amount, gasPrice, gasLimit, nonce, chainId }) {
        validator_1.default.validate({ value: amount, type: "ETH_DATA" });
        const tx = {};
        tx["to"] = this.address;
        tx["value"] = "0x0";
        // tx['data'] = generateAbiData({method: "approve", address: spender, amount});
        if (gasPrice) {
            tx["gasPrice"] = gasPrice;
        }
        if (gasLimit) {
            tx["gasLimit"] = gasLimit;
        }
        if (nonce) {
            tx["nonce"] = nonce;
        }
        if (chainId) {
            tx["chainId"] = chainId;
        }
        return tx;
    }
    transfer({ privateKey, to, amount, gasPrice, gasLimit, nonce, chainId, walletType, path }) {
        return __awaiter(this, void 0, void 0, function* () {
            // 王忱
            const tx = this.generateTransferTx({
                to,
                amount,
                gasPrice,
                gasLimit,
                nonce,
                chainId
            });
            const transaction = new transaction_1.default(tx);
            return transaction.send({ privateKey, walletType, path });
        });
    }
    approve({ spender, amount, privateKey, gasPrice, gasLimit, nonce, chainId, walletType, path }) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = this.generateApproveTx({
                spender,
                amount,
                gasPrice,
                gasLimit,
                nonce,
                chainId
            });
            const transaction = new transaction_1.default(tx);
            return transaction.send({ privateKey, walletType, path });
        });
    }
    balanceOf(owner, tag) {
        return __awaiter(this, void 0, void 0, function* () {
            validator_1.default.validate({ value: owner, type: "ADDRESS" });
            const tx = { to: this.address };
            // tx['data'] = generateAbiData({method: "balanceOf", address: owner});
            tag = tag || "pending";
            if (tag) {
                try {
                    validator_1.default.validate({ value: tag, type: "RPC_TAG" });
                }
                catch (e) {
                    throw new Error("Invalid tag, must be one of latest, pending,earliest");
                }
            }
            const params = [tx, tag];
            const body = {};
            body["method"] = "eth_call";
            body["params"] = params;
            return request_1.default(host, {
                method: "post",
                body
            });
        });
    }
    getAllowance(owner, spender, tag) {
        return __awaiter(this, void 0, void 0, function* () {
            validator_1.default.validate({ value: owner, type: "ADDRESS" });
            validator_1.default.validate({ value: spender, type: "ADDRESS" });
            const tx = {};
            tx["to"] = this.address;
            // tx['data'] = generateAbiData({method: "allowance", owner, spender});
            tag = tag || "pending";
            if (tag) {
                try {
                    validator_1.default.validate({ value: tag, type: "RPC_TAG" });
                }
                catch (e) {
                    throw new Error("Invalid tag, must be one of latest, pending,earliest");
                }
            }
            const params = [tx, tag];
            const body = {};
            body["method"] = "eth_call";
            body["params"] = params;
            return request_1.default(host, {
                method: "post",
                body
            });
        });
    }
    getName() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.getConfig("name");
            const results = ethereumjs_abi.rawDecode(["string"], formatter_1.toBuffer(response["result"]));
            return results.length > 0 ? results[0] : "";
        });
    }
    getSymbol() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.getConfig("symbol");
            const results = ethereumjs_abi.rawDecode(["string"], formatter_1.toBuffer(response["result"]));
            return results.length > 0 ? results[0] : "";
        });
    }
    getDecimals() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.getConfig("decimals");
            const results = ethereumjs_abi.rawDecode(["uint"], formatter_1.toBuffer(response["result"]));
            return results.length > 0 ? results[0].toNumber() : -1;
        });
    }
    getConfig(type) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = {};
            if (type === "decimals" || type === "symbol" || type === "name") {
                tx["to"] = this.address;
                // tx['data'] = generateAbiData({method: type});
                const params = [tx, "latest"];
                const body = {};
                body["method"] = "eth_call";
                body["params"] = params;
                return request_1.default(host, {
                    method: "post",
                    body
                });
            }
            else {
                throw new Error("Unsupported kind of config: " + type);
            }
        });
    }
    complete() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.symbol) {
                this.symbol = yield this.getSymbol();
            }
            if (!this.digits) {
                this.digits = yield this.getDecimals();
            }
            if (!this.name) {
                this.name = yield this.getName();
            }
        });
    }
}
exports.default = Token;
//# sourceMappingURL=token.js.map