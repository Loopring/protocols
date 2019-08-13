import BN = require("bn.js");
import { grpcClientService, RestApiServer } from "..";
import { generateKeyPair, sign } from "../lib/sign/eddsa";
import { ethereum } from "../lib/wallet";
import * as fm from "../lib/wallet/common/formatter";
import config from "../lib/wallet/config";
import { updateHost } from "../lib/wallet/ethereum/utils";
import Eth from "../lib/wallet/ethereum/eth";
import Transaction from "../lib/wallet/ethereum/transaction";
import { WalletAccount } from "../lib/wallet/ethereum/walletAccount";
import { DexAccount, OrderInfo, Signature } from "../model/types";
import { Order, TokenAmounts } from "../grpc/proto_gen/data_order_pb";
import {
  AccountID,
  Amount,
  Bips,
  EdDSAPrivKey,
  EdDSAPubKey,
  EdDSASignature,
  OrderID,
  TokenID
} from "../grpc/proto_gen/data_types_pb";
import {
  Account,
  SimpleOrderCancellationReq
} from "../grpc/proto_gen/service_dex_pb";

const MOCK_EXCHANGE_GAS_LIMIT = "0x30DD54";

// TODO: Rename Exchange
export class Exchange {
  private currentDexAccount: DexAccount;
  private currentWalletAccount: WalletAccount;
  private dexConfigurations;

  // Init when web app launches
  private hasInitialized: boolean;

  private exchangeID: number;
  private exchangeAddr: string;
  private walletAddressID: number;

  public contractURL: string;

  private accounts: Map<WalletAccount, DexAccount>;

  public constructor() {
    this.hasInitialized = false;
  }

  public async init(contractURL: string) {
    console.log("init exchange");
    config.initTokenConfig();

    this.contractURL = contractURL;
    // host = contractURL
    updateHost(contractURL);

    this.exchangeID = 2; // TODO: config
    this.exchangeAddr = "0x3d88d9C4adC342cEff41855CF540844268390BE6"; // TODO: config
    this.walletAddressID = 0; // TODO: config
    this.accounts = new Map<WalletAccount, DexAccount>();

    this.hasInitialized = true;

    this.dexConfigurations = await RestApiServer.getDexConfigurations();
  }

  private checkIfInitialized() {
    if (this.hasInitialized === false) {
      console.warn("lightcone_v2.js is not initialized yet");
      throw "lightcone_v2.js is not initialized yet";
    }
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

  private static genAmount(amount: BN): Amount {
    const result = new Amount();
    result.setValue(fm.toHex(amount));

    return result;
  }

  private static genBips(amount: number): Bips {
    const result = new Bips();
    result.setValue(amount);

    return result;
  }

  private static genPubKey(publicX: string, publicY: string): EdDSAPubKey {
    const result = new EdDSAPubKey();
    result.setX(publicX);
    result.setY(publicY);

    return result;
  }

  private static genPriKey(secret: string): EdDSAPrivKey {
    const result = new EdDSAPrivKey();
    result.setValue(secret);

    return result;
  }

  private static genSignature(signature: Signature): EdDSASignature {
    const result = new EdDSASignature();
    result.setRx(signature.Rx);
    result.setRy(signature.Ry);
    result.setS(signature.s);

    return result;
  }

  public flattenList = (l: any[]) => {
    return [].concat.apply([], l);
  };

  // JavaScript: Promises and Why Async/Await Wins the Battle
  // https://hackernoon.com/javascript-promises-and-why-async-await-wins-the-battle-4fc9d15d509f
  // ES7 async error handling: do it right or die
  // https://medium.com/@giovannipinto/async-error-handling-forced-to-do-it-right-2817cf9e8b43
  public async updateAccount(wallet: WalletAccount, gasPrice: number) {
    try {
      this.checkIfInitialized();

      // TODO: need to check if gasPrice is a reasonable value
      if (this.accounts.get(wallet) == null) {
        const keyPair = generateKeyPair();
        this.currentWalletAccount = wallet;
        let rawTx: Transaction = await this.createOrUpdateAccount(
          keyPair.publicKeyX,
          keyPair.publicKeyY,
          gasPrice
        );
        const signedTx = wallet.signEthereumTx(rawTx.raw);

        const sendTransactionResponse = await wallet.sendTransaction(
          new Eth(this.contractURL),
          signedTx
        );
        console.log("sendTransactionResponse: ", sendTransactionResponse);

        // TODO: Notify Relay
        /*
        .then(() => {
          // TODO: config
          grpcClientService
            .getAccount(wallet.getAddress())
            .then((account: Account) => {
              console.log(account)
              const dexAccount = new DexAccount();
              dexAccount.nonce = 0;
              dexAccount.owner = wallet.getAddress();
              dexAccount.accountID = account.getAccountId().getValue();
              dexAccount.publicKeyX = keyPair.publicKeyX;
              dexAccount.publicKeyY = keyPair.publicKeyY;
              dexAccount.secretKey = keyPair.secretKey;
              this.accounts.set(wallet, dexAccount);
              this.currentDexAccount = dexAccount;
            });
        });
        */
      }
    } catch (err) {
      console.error("Failed to create.", err);
      throw err;
    }
  }

  private async createOrUpdateAccount(
    publicX: string,
    publicY: string,
    gasPrice: number
  ) {
    try {
      this.checkIfInitialized();

      const data = ethereum.abi.Contracts.ExchangeContract.encodeInputs(
        "createOrUpdateAccount",
        {
          pubKeyX: fm.toBN(publicX),
          pubKeyY: fm.toBN(publicY)
        }
      );
      return new Transaction({
        to: this.exchangeAddr,
        value: this.dexConfigurations.account_update_fee_eth,
        data: data,
        chainId: config.getChainId(),
        nonce: fm.toHex(await ethereum.wallet.getNonce(this.getAddress())),
        gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
        gasLimit: fm.toHex(MOCK_EXCHANGE_GAS_LIMIT) // TODO: new gas limit
      });
    } catch (err) {
      console.error("Failed to create.", err);
      throw err;
    }
  }

  public async deposit(
    wallet: WalletAccount,
    symbol: string,
    amount: number,
    gasPrice: number
  ) {
    let to, value, data: string;
    try {
      this.checkIfInitialized();

      const token = config.getTokenBySymbol(symbol);
      value = fm.toHex(fm.toBig(amount).times("1e" + token.digits));
      if (wallet.getAddress()) {
        this.currentWalletAccount = wallet;
        to = symbol === "ETH" ? "0x0" : token.address;
        data = ethereum.abi.Contracts.ExchangeContract.encodeInputs("deposit", {
          tokenAddress: to,
          amount: value
        });

        const nonce = await ethereum.wallet.getNonce(this.getAddress());

        const transaction = new Transaction({
          to: to,
          value: this.dexConfigurations.deposit_fee_eth,
          data: data,
          chainId: config.getChainId(),
          nonce: fm.toHex(nonce),
          gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
          gasLimit: fm.toHex(MOCK_EXCHANGE_GAS_LIMIT) // TODO: new gas limit
        });
        return transaction;
      }
    } catch (err) {
      console.error("Failed to create.", err);
      throw err;
    }
  }

  public async withdraw(
    wallet: WalletAccount,
    symbol: string,
    amount: number,
    gasPrice: number
  ) {
    let to, value, data: string;
    try {
      this.checkIfInitialized();

      const token = config.getTokenBySymbol(symbol);
      value = fm.toHex(fm.toBig(amount).times("1e" + token.digits));
      if (wallet.getAddress()) {
        this.currentWalletAccount = wallet;
        to = symbol === "ETH" ? "0x0" : token.address;
        data = ethereum.abi.Contracts.ExchangeContract.encodeInputs(
          "withdraw",
          {
            tokenAddress: to,
            amount: value
          }
        );

        const nonce = await ethereum.wallet.getNonce(this.getAddress());

        const transaction = new Transaction({
          to: to,
          value: this.dexConfigurations.onchain_withdrawal_fee_eth,
          data: data,
          chainId: config.getChainId(),
          nonce: fm.toHex(nonce),
          gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
          gasLimit: fm.toHex(MOCK_EXCHANGE_GAS_LIMIT) // TODO: new gas limit
        });
        return transaction;
      }
    } catch (err) {
      console.error("Failed to create.", err);
      throw err;
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
    const sig = sign(this.currentDexAccount.secretKey, message);
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
      const keyPair = generateKeyPair();
      order.dualAuthPublicKeyX = keyPair.publicKeyX;
      order.dualAuthPublicKeyY = keyPair.publicKeyY;
      order.dualAuthSecretKey = keyPair.secretKey;
    }

    order.tokenIdS = config.getTokenBySymbol(order.tokenS).id;
    order.tokenIdB = config.getTokenBySymbol(order.tokenB).id;

    const nextOrderId = await grpcClientService.getNextOrderId(
      this.currentDexAccount.accountID,
      order.tokenIdS
    );
    order.orderID =
      order.orderID !== undefined ? order.orderID : nextOrderId.getValue();

    order.exchangeID =
      order.exchangeID !== undefined ? order.exchangeID : this.exchangeID;
    order.buy = order.buy !== undefined ? order.buy : true;
    order.allOrNone = order.allOrNone ? order.allOrNone : false;

    order.maxFeeBips = order.maxFeeBips !== undefined ? order.maxFeeBips : 20; // TODO: config
    order.feeBips =
      order.feeBips !== undefined ? order.feeBips : order.maxFeeBips;
    order.rebateBips = order.rebateBips !== undefined ? order.rebateBips : 0;
    order.walletAccountID =
      order.walletAccountID !== undefined
        ? order.walletAccountID
        : this.walletAddressID;

    // assert(order.maxFeeBips < 64, 'maxFeeBips >= 64');
    // assert(order.feeBips < 64, 'feeBips >= 64');
    // assert(order.rebateBips < 64, 'rebateBips >= 64');

    // Sign the order
    this.signOrder(order);
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

    const tradingPubKey = Exchange.genPubKey(
      this.currentDexAccount.publicKeyX,
      this.currentDexAccount.publicKeyY
    );
    order.setTradingPubKey(tradingPubKey);

    const dualPubKey = Exchange.genPubKey(
      orderInfo.dualAuthPublicKeyX,
      orderInfo.dualAuthPublicKeyY
    );
    order.setDualAuthPubKey(dualPubKey);

    const dualPriKey = Exchange.genPriKey(orderInfo.dualAuthSecretKey);
    order.setDualAuthPrivKey(dualPriKey);

    const tradingSig = Exchange.genSignature(orderInfo.signature);
    order.setTradingSig(tradingSig);

    return grpcClientService.submitOrder(order);
  }

  public async cancelOrder(orderInfo: OrderInfo) {
    const simpleOrderCancellationReq = new SimpleOrderCancellationReq();
    simpleOrderCancellationReq.setExchangeId(orderInfo.exchangeID);
    simpleOrderCancellationReq.setAccountId(orderInfo.accountID);
    simpleOrderCancellationReq.setMarketId(orderInfo.tokenIdS);
    simpleOrderCancellationReq.setOrderUuid(orderInfo.orderID);

    const timeStamp = new Date().getTime();
    simpleOrderCancellationReq.setTimestamp(timeStamp);

    const bits = Exchange.toBitsBN(fm.toBN(timeStamp), 32);
    const sig = sign(this.currentDexAccount.secretKey, bits);
    const edDSASignature = new EdDSASignature();
    edDSASignature.setS(sig.S);
    edDSASignature.setRx(sig.R[0].toString());
    edDSASignature.setRy(sig.R[1].toString());
    simpleOrderCancellationReq.setSig(edDSASignature);

    return grpcClientService.cancelOrder(simpleOrderCancellationReq);
  }

  private getAccountId() {
    return this.currentDexAccount.accountID;
  }

  private getAddress() {
    return this.currentWalletAccount.getAddress();
  }
}

export const exchange: Exchange = new Exchange();
