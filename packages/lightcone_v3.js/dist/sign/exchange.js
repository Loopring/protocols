"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const eddsa_1 = require("../lib/sign/eddsa");
const wallet_1 = require("../lib/wallet");
const fm = __importStar(require("../lib/wallet/common/formatter"));
const config_1 = __importDefault(require("../lib/wallet/config"));
const transaction_1 = __importDefault(require("../lib/wallet/ethereum/transaction"));
const types_1 = require("../model/types");
const Poseidon = __importStar(require("../lib/sign/poseidon"));
const sha256_1 = __importDefault(require("crypto-js/sha256"));
const assert = require("assert");
class Exchange {
    generateKeyPair(seed) {
        return eddsa_1.EdDSA.generateKeyPair(seed);
    }
    verifyPassword(publicKeyX, publicKeyY, seed) {
        const keyPair = this.generateKeyPair(seed);
        return (keyPair.publicKeyX === publicKeyX && keyPair.publicKeyY === publicKeyY);
    }
    createOrUpdateAccount(wallet, password, nonce, gasPrice, permission) {
        try {
            const keyPair = eddsa_1.EdDSA.generateKeyPair(wallet.getAddress() + password);
            this.currentWalletAccount = wallet;
            const transaction = this.createAccountAndDeposit(keyPair.publicKeyX, keyPair.publicKeyY, "", "0", permission, nonce, gasPrice);
            return {
                rawTx: transaction,
                keyPair: keyPair
            };
        }
        catch (err) {
            console.error("Failed in method updateAccount. Error: ", err);
            throw err;
        }
    }
    createAccountAndDeposit(publicX, publicY, symbol, amount, permission, nonce, gasPrice) {
        try {
            let address, value;
            const token = config_1.default.getTokenBySymbol(symbol);
            if (JSON.stringify(token) === "{}") {
                address = "0x0";
                value = "0";
            }
            else {
                address = token.address;
                value = fm.toHex(fm.toBig(amount).times("1e" + token.digits));
            }
            const data = wallet_1.ethereum.abi.Contracts.ExchangeContract.encodeInputs("updateAccountAndDeposit", {
                pubKeyX: fm.toHex(fm.toBN(publicX)),
                pubKeyY: fm.toHex(fm.toBN(publicY)),
                tokenAddress: address,
                amount: value,
                permission: permission
            });
            return new transaction_1.default({
                to: config_1.default.getExchangeAddress(),
                value: fm.toHex(config_1.default.getFeeByType("create").feeInWEI),
                data: data,
                chainId: config_1.default.getChainId(),
                nonce: fm.toHex(nonce),
                gasPrice: fm.toHex(fm.fromGWEI(gasPrice)),
                gasLimit: fm.toHex(config_1.default.getGasLimitByType("create").gasInWEI)
            });
        }
        catch (err) {
            console.error("Failed in method createOrUpdateAccount. Error: ", err);
            throw err;
        }
    }
    deposit(wallet, symbol, amount, nonce, gasPrice) {
        let to, value, data;
        try {
            const token = config_1.default.getTokenBySymbol(symbol);
            const fee = config_1.default.getFeeByType("deposit").feeInWEI;
            value = fm.toBig(amount).times("1e" + token.digits);
            if (wallet.getAddress()) {
                this.currentWalletAccount = wallet;
                if (symbol === "ETH") {
                    to = "0x0";
                    data = wallet_1.ethereum.abi.Contracts.ExchangeContract.encodeInputs("deposit", {
                        tokenAddress: to,
                        amount: fm.toHex(value)
                    });
                    value = value.plus(fee);
                }
                else {
                    to = token.address;
                    data = wallet_1.ethereum.abi.Contracts.ExchangeContract.encodeInputs("deposit", {
                        tokenAddress: to,
                        amount: fm.toHex(value)
                    });
                    value = fee;
                }
                return new transaction_1.default({
                    to: config_1.default.getExchangeAddress(),
                    value: fm.toHex(value),
                    data: data,
                    chainId: config_1.default.getChainId(),
                    nonce: fm.toHex(nonce),
                    gasPrice: fm.toHex(fm.fromGWEI(gasPrice)),
                    gasLimit: fm.toHex(config_1.default.getGasLimitByType("depositTo").gasInWEI)
                });
            }
        }
        catch (err) {
            console.error("Failed in method deposit. Error: ", err);
            throw err;
        }
    }
    withdraw(wallet, symbol, amount, nonce, gasPrice) {
        let to, value, data;
        try {
            const token = config_1.default.getTokenBySymbol(symbol);
            const fee = config_1.default.getFeeByType("withdraw").feeInWEI;
            value = fm.toBig(amount).times("1e" + token.digits);
            if (wallet.getAddress()) {
                this.currentWalletAccount = wallet;
                to = symbol === "ETH" ? "0x0" : token.address;
                data = wallet_1.ethereum.abi.Contracts.ExchangeContract.encodeInputs("withdraw", {
                    tokenAddress: to,
                    amount: fm.toHex(value)
                });
                value = fee;
                return new transaction_1.default({
                    to: config_1.default.getExchangeAddress(),
                    value: fm.toHex(value),
                    data: data,
                    chainId: config_1.default.getChainId(),
                    nonce: fm.toHex(nonce),
                    gasPrice: fm.toHex(fm.fromGWEI(gasPrice)),
                    gasLimit: fm.toHex(config_1.default.getGasLimitByType("withdrawFrom").gasInWEI)
                });
            }
        }
        catch (err) {
            console.error("Failed in method withdraw. Error: ", err);
            throw err;
        }
    }
    submitWithdrawal(withdrawal) {
        let token, feeToken;
        if (!withdrawal.token.startsWith("0x")) {
            token = config_1.default.getTokenBySymbol(withdrawal.token);
        }
        else {
            token = config_1.default.getTokenByAddress(withdrawal.token);
        }
        if (!withdrawal.tokenF.startsWith("0x")) {
            feeToken = config_1.default.getTokenBySymbol(withdrawal.tokenF);
        }
        else {
            feeToken = config_1.default.getTokenByAddress(withdrawal.tokenF);
        }
        withdrawal.tokenId = token.id;
        withdrawal.token = token.address;
        withdrawal.amountInBN = config_1.default.toWEI(token.symbol, withdrawal.amount);
        withdrawal.amount = withdrawal.amountInBN.toString(10);
        withdrawal.tokenFId = feeToken.id;
        withdrawal.tokenF = feeToken.address;
        withdrawal.amountFInBN = config_1.default.toWEI(feeToken.symbol, withdrawal.amountF);
        withdrawal.amountF = withdrawal.amountFInBN.toString(10);
        withdrawal.label =
            withdrawal.label !== undefined ? withdrawal.label : config_1.default.getLabel();
        return this.signWithdrawal(withdrawal);
    }
    signWithdrawal(withdrawal) {
        if (withdrawal.signature !== undefined) {
            return;
        }
        const account = withdrawal.account;
        const hasher = Poseidon.createHash(9, 6, 53);
        // Calculate hash
        const inputs = [
            config_1.default.getExchangeId(),
            account.accountId,
            withdrawal.tokenId,
            withdrawal.amountInBN,
            withdrawal.tokenFId,
            withdrawal.amountFInBN,
            withdrawal.label,
            account.nonce
        ];
        const hash = hasher(inputs).toString(10);
        // Create signature
        withdrawal.hash = hash;
        withdrawal.signature = eddsa_1.EdDSA.sign(account.keyPair.secretKey, hash);
        // Verify signature
        const success = eddsa_1.EdDSA.verify(hash, withdrawal.signature, [
            account.keyPair.publicKeyX,
            account.keyPair.publicKeyY
        ]);
        assert(success, "Failed to verify signature");
        return withdrawal;
    }
    signOrder(order) {
        if (order.signature !== undefined) {
            return;
        }
        const hasher = Poseidon.createHash(14, 6, 53);
        // Calculate hash
        const inputs = [
            config_1.default.getExchangeId(),
            order.orderId,
            order.accountId,
            order.tokenSId,
            order.tokenBId,
            order.amountSInBN,
            order.amountBInBN,
            order.allOrNone ? 1 : 0,
            order.validSince,
            order.validUntil,
            order.maxFeeBips,
            order.buy ? 1 : 0,
            order.label
        ];
        order.hash = hasher(inputs).toString(10);
        // Create signature
        const signature = eddsa_1.EdDSA.sign(order.keyPair.secretKey, order.hash);
        order.signature = signature;
        order.signatureRx = signature.Rx;
        order.signatureRy = signature.Ry;
        order.signatureS = signature.s;
        // Verify signature
        const success = eddsa_1.EdDSA.verify(order.hash, order.signature, [
            order.keyPair.publicKeyX,
            order.keyPair.publicKeyY
        ]);
        assert(success, "Failed to verify signature");
        return order;
    }
    setupOrder(order) {
        let tokenBuy, tokenSell;
        if (!order.tokenS.startsWith("0x")) {
            tokenSell = config_1.default.getTokenBySymbol(order.tokenS);
        }
        else {
            tokenSell = config_1.default.getTokenByAddress(order.tokenS);
        }
        if (!order.tokenB.startsWith("0x")) {
            tokenBuy = config_1.default.getTokenBySymbol(order.tokenB);
        }
        else {
            tokenBuy = config_1.default.getTokenByAddress(order.tokenB);
        }
        order.tokenS = tokenSell.address;
        order.tokenB = tokenBuy.address;
        order.tokenSId = tokenSell.id;
        order.tokenBId = tokenBuy.id;
        order.amountSInBN = config_1.default.toWEI(tokenSell.symbol, order.amountS);
        order.amountS = order.amountSInBN.toString(10);
        order.amountBInBN = config_1.default.toWEI(tokenBuy.symbol, order.amountB);
        order.amountB = order.amountBInBN.toString(10);
        order.exchangeId =
            order.exchangeId !== undefined
                ? order.exchangeId
                : config_1.default.getExchangeId();
        order.buy = order.buy !== undefined ? order.buy : false;
        order.maxFeeBips =
            order.maxFeeBips !== undefined
                ? order.maxFeeBips
                : config_1.default.getMaxFeeBips();
        order.allOrNone = order.allOrNone !== undefined ? order.allOrNone : false;
        order.feeBips =
            order.feeBips !== undefined ? order.feeBips : order.maxFeeBips;
        order.rebateBips = order.rebateBips !== undefined ? order.rebateBips : 0;
        order.label = order.label !== undefined ? order.label : config_1.default.getLabel();
        assert(order.maxFeeBips < 64, "maxFeeBips >= 64");
        assert(order.feeBips < 64, "feeBips >= 64");
        assert(order.rebateBips < 64, "rebateBips >= 64");
        assert(order.label < Math.pow(2, 16), "order.label >= 2**16");
        // Sign the order
        return this.signOrder(order);
    }
    getRandomInt(max) {
        return Math.floor(Math.random() * max);
    }
    submitOrder(wallet, request) {
        this.currentWalletAccount = wallet;
        return this.setupOrder(request);
    }
    signCancel(cancel) {
        if (cancel.signature !== undefined) {
            return;
        }
        const account = cancel.account;
        const hasher = Poseidon.createHash(9, 6, 53);
        // Calculate hash
        const inputs = [
            config_1.default.getExchangeId(),
            account.accountId,
            cancel.orderTokenId,
            cancel.orderId,
            cancel.tokenFId,
            cancel.amountFInBN,
            cancel.label,
            account.nonce
        ];
        const hash = hasher(inputs).toString(10);
        // Create signature
        cancel.signature = eddsa_1.EdDSA.sign(account.keyPair.secretKey, hash);
        // Verify signature
        const success = eddsa_1.EdDSA.verify(hash, cancel.signature, [
            account.keyPair.publicKeyX,
            account.keyPair.publicKeyY
        ]);
        assert(success, "Failed to verify signature");
        return cancel;
    }
    submitCancel(cancel) {
        let orderToken, feeToken;
        if (!cancel.orderToken.startsWith("0x")) {
            orderToken = config_1.default.getTokenBySymbol(cancel.orderToken);
        }
        else {
            orderToken = config_1.default.getTokenByAddress(cancel.orderToken);
        }
        if (!cancel.tokenF.startsWith("0x")) {
            feeToken = config_1.default.getTokenBySymbol(cancel.tokenF);
        }
        else {
            feeToken = config_1.default.getTokenByAddress(cancel.tokenF);
        }
        cancel.tokenFId = feeToken.id;
        cancel.tokenF = feeToken.symbol;
        cancel.orderTokenId = orderToken.id;
        cancel.orderToken = orderToken.symbol;
        cancel.amountFInBN = config_1.default.toWEI(feeToken.symbol, cancel.amountF);
        cancel.amountF = cancel.amountFInBN.toString(10);
        cancel.label =
            cancel.label !== undefined ? cancel.label : config_1.default.getLabel();
        return this.signCancel(cancel);
    }
    submitFlexCancel(request) {
        if (request.signature !== undefined) {
            return;
        }
        const account = request.account;
        let sign = new types_1.SignFlexCancelRequest();
        sign.accountId = account.accountId;
        sign.orderHash = request.orderHash;
        sign.clientOrderId = request.clientOrderId;
        const hash = fm.addHexPrefix(sha256_1.default(JSON.stringify(sign)).toString());
        // Create signature
        request.signature = eddsa_1.EdDSA.sign(account.keyPair.secretKey, hash);
        // Verify signature
        const success = eddsa_1.EdDSA.verify(hash, request.signature, [
            account.keyPair.publicKeyX,
            account.keyPair.publicKeyY
        ]);
        assert(success, "Failed to verify signature");
        return request;
    }
    signGetApiKey(request) {
        if (request.signature !== undefined) {
            return;
        }
        let account = request.account;
        let sign = new types_1.SignAPIKeyRequest();
        sign.accountId = account.accountId;
        sign.publicKeyX = account.keyPair.publicKeyX;
        sign.publicKeyY = account.keyPair.publicKeyY;
        const hash = fm.addHexPrefix(sha256_1.default(JSON.stringify(sign)).toString());
        // Create signature
        request.signature = eddsa_1.EdDSA.sign(account.keyPair.secretKey, hash);
        // Verify signature
        const success = eddsa_1.EdDSA.verify(hash, request.signature, [
            account.keyPair.publicKeyX,
            account.keyPair.publicKeyY
        ]);
        assert(success, "Failed to verify signature");
        return request;
    }
}
exports.Exchange = Exchange;
exports.exchange = new Exchange();
//# sourceMappingURL=exchange.js.map