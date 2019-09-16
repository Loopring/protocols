import { BitArray } from "../lib/sign/bitarray";
import { generateKeyPair, sign } from "../lib/sign/eddsa";
import { ethereum } from "../lib/wallet";
import * as fm from "../lib/wallet/common/formatter";
import config from "../lib/wallet/config";
import Transaction from "../lib/wallet/ethereum/transaction";
import { WalletAccount } from "../lib/wallet/ethereum/walletAccount";
import { OrderInfo } from "../model/types";

export class Exchange {
  private currentWalletAccount: WalletAccount;

  public async createOrUpdateAccount(
    wallet: WalletAccount,
    password: string,
    nonce: number,
    gasPrice: number
  ) {
    try {
      const keyPair = generateKeyPair(wallet.getAddress() + password);
      this.currentWalletAccount = wallet;
      const transaction = await this.createAccountAndDeposit(
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        "",
        "0",
        nonce,
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
    amount: string,
    nonce: number,
    gasPrice: number
  ) {
    try {
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

      return new Transaction({
        to: config.getExchangeAddress(),
        value: fm.toHex(config.getFeeByType("create").feeInWEI),
        data: data,
        chainId: config.getChainId(),
        nonce: fm.toHex(nonce),
        gasPrice: fm.toHex(fm.fromGWEI(gasPrice)),
        gasLimit: fm.toHex(config.getGasLimitByType("create").gasInWEI)
      });
    } catch (err) {
      console.error("Failed in method createOrUpdateAccount. Error: ", err);
      throw err;
    }
  }

  public async deposit(
    wallet: WalletAccount,
    symbol: string,
    amount: string,
    nonce: number,
    gasPrice: number
  ) {
    let to, value, data: string;
    try {
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

        return new Transaction({
          to: config.getExchangeAddress(),
          value: fm.toHex(value),
          data: data,
          chainId: config.getChainId(),
          nonce: fm.toHex(nonce),
          gasPrice: fm.toHex(fm.fromGWEI(gasPrice)),
          gasLimit: fm.toHex(config.getGasLimitByType("depositTo").gasInWEI)
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
    amount: string,
    nonce: number,
    gasPrice: number
  ) {
    let to, value, data: string;
    try {
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
        return new Transaction({
          to: config.getExchangeAddress(),
          value: fm.toHex(value),
          data: data,
          chainId: config.getChainId(),
          nonce: fm.toHex(nonce),
          gasPrice: fm.toHex(fm.fromGWEI(gasPrice)),
          gasLimit: fm.toHex(config.getGasLimitByType("withdrawFrom").gasInWEI)
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
    console.log("\n####################################");
    console.log("order.signature.Rx", order.signature.Rx);
    console.log("order.signature.Ry", order.signature.Ry);
    console.log("order.signature.s", order.signature.s);
    console.log("\n####################################");

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
    return await this.setupOrder(orderInfo);
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
}

export const exchange: Exchange = new Exchange();
