import { BitArray } from "../lib/sign/bitarray";
import { generateKeyPair, sign } from "../lib/sign/eddsa";
import { ethereum } from "../lib/wallet";
import * as fm from "../lib/wallet/common/formatter";
import config from "../lib/wallet/config";
import Transaction from "../lib/wallet/ethereum/transaction";
import { updateHost } from "../lib/wallet/ethereum/utils";
import { WalletAccount } from "../lib/wallet/ethereum/walletAccount";
import { DexAccount, OrderInfo } from "../model/types";

export class Exchange {
  private currentDexAccount: DexAccount;
  private currentWalletAccount: WalletAccount;

  // Init when web app launches
  private hasInitialized: boolean;
  public contractURL: string;
  private accounts: Map<WalletAccount, DexAccount>;

  public constructor() {
    this.hasInitialized = false;
  }

  public async init(contractURL: string) {
    console.log("init exchange");

    config.getTokens();

    this.contractURL = contractURL;
    updateHost(contractURL);

    this.accounts = new Map<WalletAccount, DexAccount>();
    this.hasInitialized = true;
  }

  private checkIfInitialized() {
    if (this.hasInitialized === false) {
      console.warn("lightcone_v2.js is not initialized yet");
      throw "lightcone_v2.js is not initialized yet";
    }
  }

  public flattenList = (l: any[]) => {
    return [].concat.apply([], l);
  };

  public async createOrUpdateAccount(
    wallet: WalletAccount,
    password: string,
    gasPrice: number
  ) {
    try {
      this.checkIfInitialized();
      const keyPair = generateKeyPair(wallet.getAddress() + password);
      this.currentWalletAccount = wallet;
      const transaction = await this.createAccountAndDeposit(
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        "",
        0,
        gasPrice
      );
      return {
        rawTx: transaction,
        keyPair: keyPair
      };
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
        to: config.getExchangeAddress(),
        value: fm.toHex(config.getFeeByType("create").feeInWEI),
        data: data,
        chainId: config.getChainId(),
        nonce: fm.toHex(nonce),
        gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
        gasLimit: fm.toHex(config.getGasLimitByType("create").gasLimit)
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
      const token = config.getTokenBySymbol(symbol);
      const fee = config.getFeeByType("deposit").feeInWEI;
      value = fm.toBig(amount).times("1e" + token.digits);

      if (wallet.getAddress()) {
        this.currentWalletAccount = wallet;
        if (symbol === "ETH") {
          to = "0x0";
          data = ethereum.abi.Contracts.ExchangeContract.encodeInputs(
            "deposit",
            {
              tokenAddress: to,
              amount: fm.toHex(value)
            }
          );
          value = value.plus(fee);
        } else {
          to = token.address;
          data = ethereum.abi.Contracts.ExchangeContract.encodeInputs(
            "deposit",
            {
              tokenAddress: to,
              amount: fm.toHex(value)
            }
          );
          value = fee;
        }

        const nonce = await ethereum.wallet.getNonce(this.getAddress());
        return new Transaction({
          to: config.getExchangeAddress(),
          value: fm.toHex(value),
          data: data,
          chainId: config.getChainId(),
          nonce: fm.toHex(nonce),
          gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)), // todo
          gasLimit: fm.toHex(config.getGasLimitByType("depositTo").gasLimit)
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
      const fee = config.getFeeByType("withdraw").feeInWEI;
      value = fm.toBig(amount).times("1e" + token.digits);

      if (wallet.getAddress()) {
        this.currentWalletAccount = wallet;
        to = symbol === "ETH" ? "0x0" : token.address;
        data = ethereum.abi.Contracts.ExchangeContract.encodeInputs(
          "withdraw",
          {
            tokenAddress: to,
            amount: fm.toHex(value)
          }
        );
        value = fee;
        const nonce = await ethereum.wallet.getNonce(this.getAddress());
        return new Transaction({
          to: config.getExchangeAddress(),
          value: fm.toHex(value),
          data: data,
          chainId: config.getChainId(),
          nonce: fm.toHex(nonce),
          gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
          gasLimit: fm.toHex(config.getGasLimitByType("withdrawFrom").gasLimit)
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
    message.addNumber(config.getExchangeId(), 32);
    message.addNumber(order.orderId, 20);
    message.addNumber(order.accountId, 20);
    message.addString(order.dualAuthPubKeyX, 254);
    message.addString(order.dualAuthPubKeyY, 254);
    message.addNumber(order.tokenSId, 8);
    message.addNumber(order.tokenBId, 8);
    message.addBN(order.amountSInBN, 96);
    message.addBN(order.amountBInBN, 96);
    message.addNumber(order.allOrNone ? 1 : 0, 1);
    message.addNumber(order.validSince, 32);
    message.addNumber(order.validUntil, 32);
    message.addNumber(order.maxFeeBips, 6);
    message.addNumber(order.buy ? 1 : 0, 1);

    const sig = sign(order.tradingPrivKey, message.getBits());
    order.hash = sig.hash;
    order.tradingSigRx = sig.R[0].toString();
    order.tradingSigRy = sig.R[1].toString();
    order.tradingSigS = sig.S.toString();

    order.signature = {
      Rx: order.tradingSigRx,
      Ry: order.tradingSigRy,
      s: order.tradingSigS
    };
    console.log("\n######################################");
    console.log("order.signature.Rx", order.signature.Rx);
    console.log("order.signature.Ry", order.signature.Ry);
    console.log("order.signature.s", order.signature.s);
    console.log("\n######################################");

    return order;
  }

  public async setupOrder(order: OrderInfo) {
    if (!order.tokenS.startsWith("0x")) {
      order.tokenS = config.getTokenBySymbol(order.tokenS).address;
    }

    if (!order.tokenB.startsWith("0x")) {
      order.tokenB = config.getTokenBySymbol(order.tokenB).address;
    }

    if (!order.dualAuthPubKeyX || !order.dualAuthPubKeyY) {
      const keyPair = generateKeyPair(this.currentWalletAccount.getAddress());
      order.dualAuthPubKeyX = keyPair.publicKeyX;
      order.dualAuthPubKeyY = keyPair.publicKeyY;
      order.dualAuthPrivKey = keyPair.secretKey;
    }

    // order.tokenSId = config.getTokenBySymbol(order.tokenS).id;
    // order.tokenBId = config.getTokenBySymbol(order.tokenB).id;

    order.exchangeId =
      order.exchangeId !== undefined
        ? order.exchangeId
        : config.getExchangeId();
    order.buy = order.buy !== undefined ? order.buy : false;
    order.allOrNone = order.allOrNone ? order.allOrNone : false;

    order.maxFeeBips =
      order.maxFeeBips !== undefined
        ? order.maxFeeBips
        : config.getMaxFeeBips();
    order.feeBips =
      order.feeBips !== undefined ? order.feeBips : order.maxFeeBips;
    order.rebateBips = order.rebateBips !== undefined ? order.rebateBips : 0;
    order.walletAccountId =
      order.walletAccountId !== undefined
        ? order.walletAccountId
        : config.getWalletId();

    return this.signOrder(order);
  }

  public async submitOrder(wallet: WalletAccount, orderInfo: OrderInfo) {
    this.currentWalletAccount = wallet;
    // In setupOrder, we will use currentWalletAccount.
    return await this.setupOrder(orderInfo);

    // order.setExchangeId(orderInfo.exchangeId);
    //
    // const orderId = new OrderID();
    // orderId.setValue(orderInfo.orderId);
    // order.setOrderId(orderId);
    //
    // const accountId = new AccountID();
    // accountId.setValue(orderInfo.accountId);
    // order.setOrderId(accountId);
    //
    // const walletID = new AccountID();
    // walletID.setValue(orderInfo.walletAccountID);
    // order.setOrderId(walletID);
    //
    // const tokenS = new TokenID();
    // tokenS.setValue(orderInfo.tokenSId);
    // order.setOrderId(tokenS);
    //
    // const tokenB = new TokenID();
    // tokenB.setValue(orderInfo.tokenBId);
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
    //   orderInfo.dualAuthPubKeyX,
    //   orderInfo.dualAuthPubKeyY
    // );
    // order.setDualAuthPubKey(dualPubKey);
    //
    // const dualPriKey = Exchange.genPriKey(orderInfo.dualAuthPrivKey);
    // order.setDualAuthPrivKey(dualPriKey);
    //
    // const tradingSig = Exchange.genSignature(orderInfo.signature);
    // order.setTradingSig(tradingSig);
    //
    // return grpcClientService.submitOrder(order);
  }

  public async cancelOrder(orderInfo: OrderInfo) {
    // const simpleOrderCancellationReq = new SimpleOrderCancellationReq();
    // simpleOrderCancellationReq.setExchangeId(orderInfo.exchangeId);
    // simpleOrderCancellationReq.setAccountId(orderInfo.accountId);
    // simpleOrderCancellationReq.setMarketId(orderInfo.tokenSId);
    // simpleOrderCancellationReq.setOrderUuid(orderInfo.orderId);
    //
    // const timeStamp = new Date().getTime();
    // simpleOrderCancellationReq.setTimestamp(timeStamp);
    //
    // const message = new BitArray();
    // const bits = message.addBN(fm.toBN(timeStamp), 32);
    // const sig = sign(this.currentDexAccount.secretKey, bits);
    // const edDSASignature = new EdDSASignature();
    // edDSASignature.setS(sig.S);
    // edDSASignature.setRx(sig.R[0].toString());
    // edDSASignature.setRy(sig.R[1].toString());
    // simpleOrderCancellationReq.setSig(edDSASignature);
    //
    // return grpcClientService.cancelOrder(simpleOrderCancellationReq);
  }

  private getAccountId() {
    return this.currentDexAccount.accountID;
  }

  private getAddress() {
    return this.currentWalletAccount.getAddress();
  }
}

export const exchange: Exchange = new Exchange();
