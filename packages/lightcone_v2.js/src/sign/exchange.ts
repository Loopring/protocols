import BN = require("bn.js");
import { grpcClientService, RestApiServer } from "..";
import {
  Amount,
  Bips,
  EdDSAPrivKey,
  EdDSAPubKey,
  EdDSASignature
} from "../grpc/proto_gen/data_types_pb";
import { SimpleOrderCancellationReq } from "../grpc/proto_gen/service_dex_pb";
import { BitArray } from "../lib/sign/bitarray";
import { generateKeyPair, sign } from "../lib/sign/eddsa";
import { ethereum } from "../lib/wallet";
import * as fm from "../lib/wallet/common/formatter";
import config from "../lib/wallet/config";
import Transaction from "../lib/wallet/ethereum/transaction";
import { updateHost } from "../lib/wallet/ethereum/utils";
import { WalletAccount } from "../lib/wallet/ethereum/walletAccount";
import { DexAccount, OrderInfo, Signature } from "../model/types";

const MOCK_EXCHANGE_GAS_LIMIT = "0x5446a0";

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

    // TODO: add config back when we can remove localStorage dependency in config
    config.initTokenConfig();

    this.contractURL = contractURL;
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

  public async createOrUpdateAccount(wallet: WalletAccount, gasPrice: number) {
    try {
      this.checkIfInitialized();

      const keyPair = generateKeyPair();
      this.currentWalletAccount = wallet;
      return await this.createAccountAndDeposit(
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        "",
        0,
        gasPrice
      );
    } catch (err) {
      console.error("Failed in method updateAccount. Error: ", err);
      throw err;
    }
  }

  private async createAccountAndDeposit(
    publicX: string,
    publicY: string,
    symbol: string,
    amount: number,
    gasPrice: number
  ) {
    try {
      this.checkIfInitialized();

      let address, value: string;
      const token = config.getTokenBySymbol(symbol);

      if (JSON.stringify(token) === "{}") {
        address = "0x0";
        value = "0";
      } else {
        address = token.address;
        value = fm.toHex(fm.toBig(amount).times("1e" + token.digits));
      }

      const data = ethereum.abi.Contracts.ExchangeContract.encodeInputs(
        "updateAccountAndDeposit",
        {
          pubKeyX: fm.toHex(fm.toBN(publicX)),
          pubKeyY: fm.toHex(fm.toBN(publicY)),
          tokenAddress: address,
          amount: value
        }
      );

      const nonce = await ethereum.wallet.getNonce(this.getAddress());
      return new Transaction({
        to: this.exchangeAddr,
        value: this.dexConfigurations["deposit_fee_eth"],
        data: data,
        chainId: config.getChainId(),
        nonce: fm.toHex(nonce),
        gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
        gasLimit: fm.toHex(MOCK_EXCHANGE_GAS_LIMIT) // TODO: new gas limit
      });
    } catch (err) {
      console.error("Failed in method createOrUpdateAccount. Error: ", err);
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
      this.dexConfigurations = await RestApiServer.getDexConfigurations();

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

        return new Transaction({
          to: this.exchangeAddr,
          value: this.dexConfigurations["deposit_fee_eth"],
          data: data,
          chainId: config.getChainId(),
          nonce: fm.toHex(nonce),
          gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
          gasLimit: fm.toHex(MOCK_EXCHANGE_GAS_LIMIT) // TODO: new gas limit
        });
      }
    } catch (err) {
      console.error("Failed in method deposit. Error: ", err);
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
        return new Transaction({
          to: this.exchangeAddr,
          value: this.dexConfigurations.onchain_withdrawal_fee_eth,
          data: data,
          chainId: config.getChainId(),
          nonce: fm.toHex(nonce),
          gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
          gasLimit: fm.toHex(MOCK_EXCHANGE_GAS_LIMIT) // TODO: new gas limit
        });
      }
    } catch (err) {
      console.error("Failed in method withdraw. Error: ", err);
      throw err;
    }
  }

  public signOrder(order: OrderInfo) {
    if (order.signature !== undefined) {
      return;
    }
    const message = new BitArray();
    message.addNumber(this.exchangeID, 32);
    message.addNumber(order.orderID, 20);
    message.addNumber(order.accountID, 20);
    message.addString(order.dualAuthPublicKeyX, 254);
    message.addString(order.dualAuthPublicKeyY, 254);
    message.addNumber(order.tokenIdS, 8);
    message.addNumber(order.tokenIdB, 8);
    message.addBN(order.amountS, 96);
    message.addBN(order.amountB, 96);
    message.addNumber(order.allOrNone ? 1 : 0, 1);
    message.addNumber(order.validSince, 32);
    message.addNumber(order.validUntil, 32);
    message.addNumber(order.maxFeeBips, 6);
    message.addNumber(order.buy ? 1 : 0, 1);
    // const account = this.accounts[this.exchangeID][order.accountID];
    const sig = sign("1", message.getBits()); // TODO: signature
    order.hash = sig.hash;
    order.signature = {
      Rx: sig.R[0].toString(),
      Ry: sig.R[1].toString(),
      s: sig.S.toString()
    };
    // console.log(order.signature);
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

    return this.signOrder(order);
  }

  public async submitOrder(orderInfo: OrderInfo) {
    // const order = new Order();
    return await this.setupOrder(orderInfo);

    // order.setExchangeId(orderInfo.exchangeID);
    //
    // const orderID = new OrderID();
    // orderID.setValue(orderInfo.orderID);
    // order.setOrderId(orderID);
    //
    // const accountID = new AccountID();
    // accountID.setValue(orderInfo.accountID);
    // order.setOrderId(accountID);
    //
    // const walletID = new AccountID();
    // walletID.setValue(orderInfo.walletAccountID);
    // order.setOrderId(walletID);
    //
    // const tokenS = new TokenID();
    // tokenS.setValue(orderInfo.tokenIdS);
    // order.setOrderId(tokenS);
    //
    // const tokenB = new TokenID();
    // tokenB.setValue(orderInfo.tokenIdB);
    // order.setOrderId(tokenB);
    //
    // const tokenAmounts = new TokenAmounts();
    // const amountS = Exchange.genAmount(orderInfo.amountS);
    // const amountB = Exchange.genAmount(orderInfo.amountB);
    // tokenAmounts.setAmountS(amountS);
    // tokenAmounts.setAmountB(amountB);
    // order.setAmounts(tokenAmounts);
    //
    // let bips = Exchange.genBips(orderInfo.maxFeeBips);
    // order.setMaxFee(bips);
    // bips = Exchange.genBips(orderInfo.feeBips);
    // order.setFee(bips);
    // bips = Exchange.genBips(orderInfo.rebateBips);
    // order.setRebate(bips);
    //
    // order.setAllOrNone(orderInfo.allOrNone);
    // order.setValidSince(orderInfo.validSince);
    // order.setValidUntil(orderInfo.validUntil);
    // order.setBuy(orderInfo.buy);
    //
    // const tradingPubKey = Exchange.genPubKey(
    //   this.currentDexAccount.publicKeyX,
    //   this.currentDexAccount.publicKeyY
    // );
    // order.setTradingPubKey(tradingPubKey);
    //
    // const dualPubKey = Exchange.genPubKey(
    //   orderInfo.dualAuthPublicKeyX,
    //   orderInfo.dualAuthPublicKeyY
    // );
    // order.setDualAuthPubKey(dualPubKey);
    //
    // const dualPriKey = Exchange.genPriKey(orderInfo.dualAuthSecretKey);
    // order.setDualAuthPrivKey(dualPriKey);
    //
    // const tradingSig = Exchange.genSignature(orderInfo.signature);
    // order.setTradingSig(tradingSig);
    //
    // return grpcClientService.submitOrder(order);
  }

  public async cancelOrder(orderInfo: OrderInfo) {
    const simpleOrderCancellationReq = new SimpleOrderCancellationReq();
    simpleOrderCancellationReq.setExchangeId(orderInfo.exchangeID);
    simpleOrderCancellationReq.setAccountId(orderInfo.accountID);
    simpleOrderCancellationReq.setMarketId(orderInfo.tokenIdS);
    simpleOrderCancellationReq.setOrderUuid(orderInfo.orderID);

    const timeStamp = new Date().getTime();
    simpleOrderCancellationReq.setTimestamp(timeStamp);

    const message = new BitArray();
    const bits = message.addBN(fm.toBN(timeStamp), 32);
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
