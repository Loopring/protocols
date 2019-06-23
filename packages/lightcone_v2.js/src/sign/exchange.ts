import BN = require('bn.js');
import eddsa = require('lib/sign/eddsa');
import config from 'lib/wallet/config';

import {grpcClient} from '../grpc/grpcClient';
import {DexAccount, OrderInfo, Signature} from '../model/types';
import Transaction from "../../lib/wallet/ethereum/transaction";
import * as fm from "../../lib/wallet/common/formatter";
import {ethereum} from "../../lib/wallet";
import {WalletAccount} from "../../lib/wallet/ethereum/walletAccount";
import {Account, GetNextOrderIdReq} from "../../proto_gen/service_dex_pb";
import {Order, TokenAmounts} from "../../proto_gen/data_order_pb";
import {
    AccountID,
    Amount,
    Bips,
    EdDSAPrivKey,
    EdDSAPubKey,
    EdDSASignature,
    OrderID,
    TokenID
} from "../../proto_gen/data_types_pb";
import Eth from "../../lib/wallet/ethereum/eth";

export class Exchange {

    private exchangeID: number;
    private exchangeAddr: string;
    private walletAccountID: number;
    private currentDexAccount: DexAccount;
    private currentWalletAccount: WalletAccount;
    private accounts: Map<WalletAccount, DexAccount>;

    public constructor() {
        this.exchangeID = 0;  // TODO: config
        this.exchangeAddr = '0x'; // TODO: config
        this.walletAccountID = 0; // TODO: config
        this.accounts = new Map<WalletAccount, DexAccount>();
    }

    public static toBitsBN(value: BN, length: number) {
        const res = new Array(length);
        for (let i = 0; i < length; i++) {
            res[i] = value.testn(i) ? 1 : 0;
        }
        return res;
    }

    public static toBitsNumber(value: number, length: number) {
        return Exchange.toBitsBN(new BN(value), length);
    }

    public static toBitsString(value: string, length: number) {
        return Exchange.toBitsBN(new BN(value, 10), length);
    }

    public flattenList = (l: any[]) => {
        return [].concat.apply([], l);
    };

    private getAccountId() {
        return this.currentDexAccount.accountID;
    }

    private getAddress() {
        return this.currentWalletAccount.getAddress();
    }

    public async createAccount(wallet: WalletAccount, gasPrice: number) {
        if (this.accounts.get(wallet) == null) {
            const keyPair = eddsa.generateKeyPair();
            this.createOrUpdateAccount(keyPair.publicKeyX, keyPair.publicKeyY, gasPrice).then((rawTx: Transaction) => {
                    const signedTx = wallet.signEthereumTx(rawTx);
                    wallet.sendTransaction(new Eth(''), signedTx).then(() => { // TODO: config
                        grpcClient.getAccount(wallet.getAddress()).then((account: Account) => {
                            const dexAccount = new DexAccount();
                            dexAccount.nonce = 0;
                            dexAccount.owner = wallet.getAddress();
                            dexAccount.accountID = account.getAccountId();
                            dexAccount.publicKeyX = keyPair.publicKeyX;
                            dexAccount.publicKeyY = keyPair.publicKeyY;
                            dexAccount.secretKey = keyPair.secretKey;
                            this.accounts.set(wallet, dexAccount);
                            this.currentDexAccount = dexAccount;
                            this.currentWalletAccount = wallet;
                        });
                    })
                }
            );
        }
    }

    public async createOrUpdateAccount(publicX: string, publicY: string, gasPrice: number) {
        let data = ethereum.abi.Contracts.ExchangeContract.encodeInputs('createOrUpdateAccount', {
            pubKeyX: publicX,
            pubKeyY: publicY
        });
        return new Transaction({
            to: this.exchangeAddr,
            value: '0x0',
            data: data,
            chainId: config.getChainId(),
            nonce: fm.toHex((await ethereum.wallet.getNonce(this.getAddress()))),
            gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
            gasLimit: fm.toHex(config.getGasLimitByType('eth_transfer').gasLimit) // TODO: new gas limit
        })
    }

    public async deposit(symbol: string, amount: number, gasPrice: number) {
        let to, value, data: string;
        let token = config.getTokenBySymbol(symbol);
        value = fm.toHex(fm.toBig(amount).times("1e" + token.digits));
        if (this.currentWalletAccount.getAddress()) {
            if (symbol === 'ETH') {
                to = this.exchangeAddr;
                data = fm.toHex('0x');
            } else {
                to = token.address;
                data = ethereum.abi.Contracts.ExchangeContract.encodeInputs('deposit', {
                    tokenAddress: to,
                    amount: value
                });
                value = '0x0';
            }
            return new Transaction({
                to: to,
                value: value,
                data: data,
                chainId: config.getChainId(),
                nonce: fm.toHex((await ethereum.wallet.getNonce(this.getAddress()))),
                gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
                gasLimit: fm.toHex(config.getGasLimitByType('eth_transfer').gasLimit) // TODO: new gas limit
            });
        }
    }

    public async withdraw(symbol: string, amount: number, gasPrice: number) {
        let to, value, data: string;
        let token = config.getTokenBySymbol(symbol);
        value = fm.toHex(fm.toBig(amount).times("1e" + token.digits));
        if (this.getAddress()) {
            if (symbol === 'ETH') {
                to = this.exchangeAddr;
                data = fm.toHex('0x');
            } else {
                to = token.address;
                data = ethereum.abi.Contracts.ExchangeContract.encodeInputs('withdraw', {
                    tokenAddress: to,
                    amount: value
                });
                value = '0x0';
            }
            return new Transaction({
                to: to,
                value: value,
                data: data,
                chainId: config.getChainId(),
                nonce: fm.toHex((await ethereum.wallet.getNonce(this.getAddress()))),
                gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
                gasLimit: fm.toHex(config.getGasLimitByType('eth_transfer').gasLimit) // TODO: new gas limit
            });
        }
    }

    public signOrder(order: OrderInfo) {
        const message = this.flattenList([
            Exchange.toBitsNumber(this.exchangeID, 32),
            Exchange.toBitsNumber(order.orderID, 20),
            Exchange.toBitsNumber(order.accountID, 20),
            Exchange.toBitsString(order.dualAuthPublicKeyX, 254),
            Exchange.toBitsString(order.dualAuthPublicKeyY, 254),
            Exchange.toBitsNumber(order.tokenIdS, 8),
            Exchange.toBitsNumber(order.tokenIdB, 8),
            Exchange.toBitsBN(order.amountS, 96),
            Exchange.toBitsBN(order.amountB, 96),
            Exchange.toBitsNumber(order.allOrNone ? 1 : 0, 1),
            Exchange.toBitsNumber(order.validSince, 32),
            Exchange.toBitsNumber(order.validUntil, 32),
            Exchange.toBitsNumber(order.maxFeeBips, 6),
            Exchange.toBitsNumber(order.buy ? 1 : 0, 1)
        ]);
        const sig = eddsa.sign(this.currentDexAccount.secretKey, message);
        order.hash = sig.hash;
        order.signature = {
            Rx: sig.R[0].toString(),
            Ry: sig.R[1].toString(),
            s: sig.S.toString()
        };
    }

    public async setupOrder(order: OrderInfo) {
        if (!order.tokenS.startsWith("0x")) {
            order.tokenS = config.getTokenBySymbol(order.tokenS).address;
        }
        if (!order.tokenB.startsWith("0x")) {
            order.tokenB = config.getTokenBySymbol(order.tokenB).address;
        }
        if (!order.dualAuthPublicKeyX || !order.dualAuthPublicKeyY) {
            const keyPair = eddsa.generateKeyPair();
            order.dualAuthPublicKeyX = keyPair.publicKeyX;
            order.dualAuthPublicKeyY = keyPair.publicKeyY;
            order.dualAuthSecretKey = keyPair.secretKey;
        }

        order.tokenIdS = config.getTokenBySymbol(order.tokenS).id;
        order.tokenIdB = config.getTokenBySymbol(order.tokenB).id;

        const getNextOrderIdReq = new GetNextOrderIdReq();
        getNextOrderIdReq.setTokenId(order.tokenIdS);
        getNextOrderIdReq.setAccountId(this.currentDexAccount.accountID);
        const nextOrderId = await grpcClient.getNextOrderId(getNextOrderIdReq);
        order.orderID = (order.orderID !== undefined) ? order.orderID : nextOrderId.getValue();

        order.exchangeID = (order.exchangeID !== undefined) ? order.exchangeID : this.exchangeID;
        order.buy = (order.buy !== undefined) ? order.buy : true;
        order.allOrNone = order.allOrNone ? order.allOrNone : false;

        order.maxFeeBips = (order.maxFeeBips !== undefined) ? order.maxFeeBips : 20;  // TODO: config
        order.feeBips = (order.feeBips !== undefined) ? order.feeBips : order.maxFeeBips;
        order.rebateBips = (order.rebateBips !== undefined) ? order.rebateBips : 0;
        order.walletAccountID = (order.walletAccountID !== undefined) ? order.walletAccountID : this.walletAccountID;

        assert(order.maxFeeBips < 64, "maxFeeBips >= 64");
        assert(order.feeBips < 64, "feeBips >= 64");
        assert(order.rebateBips < 64, "rebateBips >= 64");

        // Sign the order
        this.signOrder(order);
    }

    private static genAmount(amount: BN): Amount {
        const result = new Amount();
        result.setValue(fm.toHex(amount));
        return result
    }

    private static genBips(amount: number): Bips {
        const result = new Bips();
        result.setValue(amount);
        return result
    }

    private static genPubKey(publicX: string, publicY: string): EdDSAPubKey {
        const result = new EdDSAPubKey();
        result.setX(publicX);
        result.setY(publicY);
        return result
    }

    private static genPriKey(secret: string): EdDSAPrivKey {
        const result = new EdDSAPrivKey();
        result.setValue(secret);
        return result
    }

    private static genSignature(signature: Signature): EdDSASignature {
        const result = new EdDSASignature();
        result.setRx(signature.Rx);
        result.setRy(signature.Ry);
        result.setS(signature.s);
        return result
    }

    public async submitOrder(orderInfo: OrderInfo) {
        const order = new Order();
        await this.setupOrder(orderInfo);

        order.setExchangeId(orderInfo.exchangeID);

        const orderID = new OrderID();
        orderID.setValue(orderInfo.orderID);
        order.setOrderId(orderID);

        const accountID = new AccountID();
        accountID.setValue(orderInfo.accountID);
        order.setOrderId(accountID);

        const walletID = new AccountID();
        walletID.setValue(orderInfo.walletAccountID);
        order.setOrderId(walletID);

        const tokenS = new TokenID();
        tokenS.setValue(orderInfo.tokenIdS);
        order.setOrderId(tokenS);

        const tokenB = new TokenID();
        tokenB.setValue(orderInfo.tokenIdB);
        order.setOrderId(tokenB);

        const tokenAmounts = new TokenAmounts();
        const amountS = Exchange.genAmount(orderInfo.amountS);
        const amountB = Exchange.genAmount(orderInfo.amountB);
        tokenAmounts.setAmountS(amountS);
        tokenAmounts.setAmountB(amountB);
        order.setAmounts(tokenAmounts);

        let bips = Exchange.genBips(orderInfo.maxFeeBips);
        order.setMaxFee(bips);
        bips = Exchange.genBips(orderInfo.feeBips);
        order.setFee(bips);
        bips = Exchange.genBips(orderInfo.rebateBips);
        order.setRebate(bips);

        order.setAllOrNone(orderInfo.allOrNone);
        order.setValidSince(orderInfo.validSince);
        order.setValidUntil(orderInfo.validUntil);
        order.setBuy(orderInfo.buy);

        const tradingPubKey = Exchange.genPubKey(this.currentDexAccount.publicKeyX, this.currentDexAccount.publicKeyY);
        order.setTradingPubKey(tradingPubKey);

        const dualPubKey = Exchange.genPubKey(orderInfo.dualAuthPublicKeyX, orderInfo.dualAuthPublicKeyY);
        order.setDualAuthPubKey(dualPubKey);

        const dualPriKey = Exchange.genPriKey(orderInfo.dualAuthSecretKey);
        order.setDualAuthPrivKey(dualPriKey);

        const tradingSig = Exchange.genSignature(orderInfo.signature);
        order.setTradingSig(tradingSig);

        return grpcClient.submitOrder(order);
    }

}

export const exchange: Exchange = new Exchange();
