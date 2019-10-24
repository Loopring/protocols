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
const __1 = require("..");
const fm = __importStar(require("../lib/wallet/common/formatter"));
const config_1 = __importDefault(require("../lib/wallet/config"));
const Contracts_1 = __importDefault(require("../lib/wallet/ethereum/contracts/Contracts"));
const transaction_1 = __importDefault(require("../lib/wallet/ethereum/transaction"));
const types_1 = require("../model/types");
const assert = require("assert");
class Account {
    constructor(account) {
        this.account = account;
    }
    /**
     * Approve Zero
     * @param symbol: approve token symbol to zero
     * @param nonce: Ethereum nonce of this address
     * @param gasPrice: gas price in gwei
     */
    approveZero(symbol, nonce, gasPrice) {
        const token = config_1.default.getTokenBySymbol(symbol);
        const rawTx = new transaction_1.default({
            to: token.address,
            value: "0x0",
            data: Contracts_1.default.ERC20Token.encodeInputs("approve", {
                _spender: config_1.default.getExchangeAddress(),
                _value: "0x0"
            }),
            chainId: config_1.default.getChainId(),
            nonce: fm.toHex(nonce),
            gasPrice: fm.toHex(fm.fromGWEI(gasPrice)),
            gasLimit: fm.toHex(config_1.default.getGasLimitByType("approve").gasInWEI)
        });
        return this.account.signEthereumTx(rawTx.raw);
    }
    /**
     * Approve Max
     * @param symbol: approve token symbol to max
     * @param nonce: Ethereum nonce of this address
     * @param gasPrice: gas price in gwei
     */
    approveMax(symbol, nonce, gasPrice) {
        const token = config_1.default.getTokenBySymbol(symbol);
        const rawTx = new transaction_1.default({
            to: token.address,
            value: "0x0",
            data: Contracts_1.default.ERC20Token.encodeInputs("approve", {
                _spender: config_1.default.getExchangeAddress(),
                _value: config_1.default.getMaxAmountInWEI()
            }),
            chainId: config_1.default.getChainId(),
            nonce: fm.toHex(nonce),
            gasPrice: fm.toHex(fm.fromGWEI(gasPrice)),
            gasLimit: fm.toHex(config_1.default.getGasLimitByType("approve").gasInWEI)
        });
        return this.account.signEthereumTx(rawTx.raw);
    }
    /**
     * generate key pair of account in DEX
     * @param password: account specified password
     */
    generateKeyPair(password) {
        try {
            assert(this.account !== null);
            return __1.exchange.generateKeyPair(this.account.getAddress() + password);
        }
        catch (e) {
            throw e;
        }
    }
    /**
     * verify password of account in DEX
     * @param publicKeyX: publicKeyX of account's key pair
     * @param publicKeyY: publicKeyY of account's key pair
     * @param password: account specified password
     */
    verifyPassword(publicKeyX, publicKeyY, password) {
        try {
            assert(this.account !== null);
            return __1.exchange.verifyPassword(publicKeyX, publicKeyY, this.account.getAddress() + password);
        }
        catch (e) {
            throw e;
        }
    }
    /**
     * create Or Update Account in DEX
     * @param gasPrice: in gwei
     * @param nonce: Ethereum nonce of this address
     * @param permission: user permission
     * @param password: user password
     */
    createOrUpdateAccount(password, nonce, gasPrice, permission) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                permission = permission !== undefined ? permission : "";
                const createOrUpdateAccountResposne = __1.exchange.createOrUpdateAccount(this.account, password, nonce, gasPrice, fm.toBuffer(permission));
                const rawTx = createOrUpdateAccountResposne["rawTx"];
                const signedEthereumTx = yield this.account.signEthereumTx(rawTx.raw);
                return {
                    signedTx: signedEthereumTx,
                    keyPair: createOrUpdateAccountResposne["keyPair"]
                };
            }
            catch (e) {
                throw e;
            }
        });
    }
    /**
     * Deposit to Dex
     * @param symbol: string symbol of token to deposit
     * @param amount: string number amount to deposit, e.g. '1.5'
     * @param nonce: Ethereum nonce of this address
     * @param gasPrice: gas price in gwei
     */
    depositTo(symbol, amount, nonce, gasPrice) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const rawTx = __1.exchange.deposit(this.account, symbol, amount, nonce, gasPrice);
                return yield this.account.signEthereumTx(rawTx.raw);
            }
            catch (e) {
                throw e;
            }
        });
    }
    /**
     * On-chain Withdrawal from Dex
     * @param symbol: string symbol of token to withdraw
     * @param amount: string number amount to withdraw, e.g. '1.5'
     * @param nonce: Ethereum nonce of this address
     * @param gasPrice: gas price in gwei
     */
    onchainWithdrawal(symbol, amount, nonce, gasPrice) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const rawTx = __1.exchange.withdraw(this.account, symbol, amount, nonce, gasPrice);
                return yield this.account.signEthereumTx(rawTx.raw);
            }
            catch (e) {
                throw e;
            }
        });
    }
    /**
     * Off-chain Withdrawal from Dex
     * @param accountId: account ID in exchange
     * @param publicKeyX: trading public key X of account, decimal string
     * @param publicKeyY: trading public key Y of account, decimal string
     * @param privateKey: trading private key of account, decimal string
     * @param nonce: DEX nonce of account
     * @param token: token symbol or address to withdraw
     * @param amount: amount to withdraw, in decimal string. e.g. '15'
     * @param tokenF: fee token symbol or address to withdraw
     * @param amountF: withdrawal fee, in decimal string. e.g. '15'
     * @param label: [OPTIONAL] label used in protocol
     */
    offchainWithdrawal(accountId, publicKeyX, publicKeyY, privateKey, nonce, token, amount, tokenF, amountF, label) {
        try {
            const withdraw = new types_1.WithdrawalRequest();
            const account = new types_1.DexAccount();
            account.keyPair = new types_1.KeyPair();
            withdraw.account = account;
            withdraw.account.accountId = accountId;
            withdraw.account.keyPair.publicKeyX = publicKeyX;
            withdraw.account.keyPair.publicKeyY = publicKeyY;
            withdraw.account.keyPair.secretKey = privateKey;
            withdraw.account.nonce = nonce;
            withdraw.token = token;
            withdraw.amount = amount;
            withdraw.tokenF = tokenF;
            withdraw.amountF = amountF;
            withdraw.label = label;
            return __1.exchange.submitWithdrawal(withdraw);
        }
        catch (e) {
            throw e;
        }
    }
    /**
     * Get signed order, should be submitted by frontend itself TEMPORARY
     * @param owner: Ethereum address of this order's owner
     * @param accountId: account ID in exchange
     * @param tokenS: symbol or hex address of token sell
     * @param tokenB: symbol or hex address of token buy
     * @param publicKeyX: trading public key X of account, decimal string
     * @param publicKeyY: trading public key Y of account, decimal string
     * @param privateKey: trading private key of account, decimal string
     * @param amountS: amount of token sell, in string number
     * @param amountB: amount of token buy, in string number
     * @param orderId: next order ID, needed by order signature
     * @param validSince: valid beginning period of this order, SECOND in timestamp
     * @param validUntil: valid ending period of this order, SECOND in timestamp
     * @param label: [OPTIONAL] label used in protocol
     */
    submitOrder(owner, accountId, publicKeyX, publicKeyY, privateKey, tokenS, tokenB, amountS, amountB, orderId, validSince, validUntil, label) {
        try {
            const order = new types_1.OrderRequest();
            order.owner = owner;
            order.accountId = accountId;
            order.keyPair = new types_1.KeyPair();
            order.keyPair.publicKeyX = publicKeyX;
            order.keyPair.publicKeyY = publicKeyY;
            order.keyPair.secretKey = privateKey;
            order.tokenS = tokenS;
            order.tokenB = tokenB;
            order.amountS = amountS;
            order.amountB = amountB;
            order.orderId = orderId;
            order.validSince = Math.floor(validSince);
            order.validUntil = Math.floor(validUntil);
            order.label = label;
            return __1.exchange.submitOrder(this.account, order);
        }
        catch (e) {
            throw e;
        }
    }
    /**
     * Cancel order in Dex
     * @param accountId: account ID in exchange
     * @param publicKeyX: trading public key X of account, decimal string
     * @param publicKeyY: trading public key Y of account, decimal string
     * @param privateKey: trading private key of account, decimal string
     * @param nonce: DEX nonce of account
     * @param orderToken: token symbol or address of cancel
     * @param orderId: specified order id to cancel
     * @param tokenF: amountF token symbol or address of cancel
     * @param amountF: cancel amountF, e.g. '15'
     * @param label: [OPTIONAL] label used in protocol
     */
    submitCancel(accountId, publicKeyX, publicKeyY, privateKey, nonce, orderToken, orderId, tokenF, amountF, label) {
        try {
            const cancel = new types_1.CancelRequest();
            const account = new types_1.DexAccount();
            account.keyPair = new types_1.KeyPair();
            cancel.account = account;
            cancel.account.accountId = accountId;
            cancel.account.keyPair.publicKeyX = publicKeyX;
            cancel.account.keyPair.publicKeyY = publicKeyY;
            cancel.account.keyPair.secretKey = privateKey;
            cancel.account.nonce = nonce;
            cancel.orderToken = orderToken;
            cancel.orderId = orderId;
            cancel.tokenF = tokenF;
            cancel.amountF = amountF;
            cancel.label = label;
            return __1.exchange.submitCancel(cancel);
        }
        catch (e) {
            throw e;
        }
    }
    /**
     * Get Api Key signature
     * @param accountId: account ID in exchange
     * @param publicKeyX: trading public key X of account, decimal string
     * @param publicKeyY: trading public key Y of account, decimal string
     * @param privateKey: trading private key of account, decimal string
     */
    getApiKey(accountId, publicKeyX, publicKeyY, privateKey) {
        try {
            const request = new types_1.GetAPIKeyRequest();
            const account = new types_1.DexAccount();
            account.keyPair = new types_1.KeyPair();
            request.account = account;
            request.account.accountId = accountId;
            request.account.keyPair.publicKeyX = publicKeyX;
            request.account.keyPair.publicKeyY = publicKeyY;
            request.account.keyPair.secretKey = privateKey;
            return __1.exchange.signGetApiKey(request);
        }
        catch (e) {
            throw e;
        }
    }
    /**
     * Get Api Key signature
     * @param accountId: account ID in exchange
     * @param publicKeyX: trading public key X of account, decimal string
     * @param publicKeyY: trading public key Y of account, decimal string
     * @param privateKey: trading private key of account, decimal string
     * @param orderHash: [OPTIONAL] specified order hash to cancel
     * @param clientOrderId: [OPTIONAL] specified client order ID to cancel
     */
    submitFlexCancel(accountId, publicKeyX, publicKeyY, privateKey, orderHash, clientOrderId) {
        try {
            const request = new types_1.FlexCancelRequest();
            const account = new types_1.DexAccount();
            account.keyPair = new types_1.KeyPair();
            request.account = account;
            request.account.accountId = accountId;
            request.account.keyPair.publicKeyX = publicKeyX;
            request.account.keyPair.publicKeyY = publicKeyY;
            request.account.keyPair.secretKey = privateKey;
            request.orderHash = orderHash;
            request.clientOrderId = clientOrderId;
            return __1.exchange.submitFlexCancel(request);
        }
        catch (e) {
            throw e;
        }
    }
}
exports.Account = Account;
//# sourceMappingURL=account.js.map