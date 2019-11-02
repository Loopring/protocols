import { EdDSA } from "../lib/sign/eddsa";
import { ethereum } from "../lib/wallet";
import * as fm from "../lib/wallet/common/formatter";
import config from "../lib/wallet/config";
import Transaction from "../lib/wallet/ethereum/transaction";
import { WalletAccount } from "../lib/wallet/ethereum/walletAccount";
import {
  CancelRequest,
  FlexCancelRequest,
  GetAPIKeyRequest,
  OrderRequest,
  SignAPIKeyRequest,
  SignFlexCancelRequest,
  WithdrawalRequest
} from "../model/types";
import * as Poseidon from "../lib/sign/poseidon";
import sha256 from "crypto-js/sha256";

const assert = require("assert");

export class Exchange {
  private currentWalletAccount: WalletAccount;

  public generateKeyPair(seed: string) {
    return EdDSA.generateKeyPair(seed);
  }

  public verifyPassword(publicKeyX: string, publicKeyY: string, seed: string) {
    const keyPair = this.generateKeyPair(seed);
    return (
      keyPair.publicKeyX === publicKeyX && keyPair.publicKeyY === publicKeyY
    );
  }

  public createOrUpdateAccount(
    wallet: WalletAccount,
    password: string,
    nonce: number,
    gasPrice: number,
    permission: Buffer
  ) {
    try {
      const keyPair = EdDSA.generateKeyPair(wallet.getAddress() + password);
      this.currentWalletAccount = wallet;
      const transaction = this.createAccountAndDeposit(
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        "",
        "0",
        permission,
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

  private createAccountAndDeposit(
    publicX: string,
    publicY: string,
    symbol: string,
    amount: string,
    permission: Buffer,
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
          amount: value,
          permission: permission
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

  public deposit(
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

  public withdraw(
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

  public submitWithdrawal(withdrawal: WithdrawalRequest) {
    let token, feeToken;
    if (!withdrawal.token.startsWith("0x")) {
      token = config.getTokenBySymbol(withdrawal.token);
    } else {
      token = config.getTokenByAddress(withdrawal.token);
    }
    if (!withdrawal.tokenF.startsWith("0x")) {
      feeToken = config.getTokenBySymbol(withdrawal.tokenF);
    } else {
      feeToken = config.getTokenByAddress(withdrawal.tokenF);
    }
    withdrawal.tokenId = token.id;
    withdrawal.token = token.address;
    withdrawal.amountInBN = config.toWEI(token.symbol, withdrawal.amount);
    withdrawal.amount = withdrawal.amountInBN.toString(10);

    withdrawal.tokenFId = feeToken.id;
    withdrawal.tokenF = feeToken.address;
    withdrawal.amountFInBN = config.toWEI(feeToken.symbol, withdrawal.amountF);
    withdrawal.amountF = withdrawal.amountFInBN.toString(10);

    withdrawal.label =
      withdrawal.label !== undefined ? withdrawal.label : config.getLabel();
    return this.signWithdrawal(withdrawal);
  }

  public signWithdrawal(withdrawal: WithdrawalRequest) {
    if (withdrawal.signature !== undefined) {
      return;
    }
    const account = withdrawal.account;
    const hasher = Poseidon.createHash(9, 6, 53);

    // Calculate hash
    const inputs = [
      config.getExchangeId(),
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
    withdrawal.signature = EdDSA.sign(account.keyPair.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, withdrawal.signature, [
      account.keyPair.publicKeyX,
      account.keyPair.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
    return withdrawal;
  }

  public signOrder(order: OrderRequest) {
    if (order.signature !== undefined) {
      return;
    }
    const hasher = Poseidon.createHash(14, 6, 53);

    // Calculate hash
    const inputs = [
      config.getExchangeId(),
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
    const signature = EdDSA.sign(order.keyPair.secretKey, order.hash);
    order.signature = signature;
    order.signatureRx = signature.Rx;
    order.signatureRy = signature.Ry;
    order.signatureS = signature.s;

    // Verify signature
    const success = EdDSA.verify(order.hash, order.signature, [
      order.keyPair.publicKeyX,
      order.keyPair.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
    return order;
  }

  public setupOrder(order: OrderRequest) {
    let tokenBuy, tokenSell;
    if (!order.tokenS.startsWith("0x")) {
      tokenSell = config.getTokenBySymbol(order.tokenS);
    } else {
      tokenSell = config.getTokenByAddress(order.tokenS);
    }
    if (!order.tokenB.startsWith("0x")) {
      tokenBuy = config.getTokenBySymbol(order.tokenB);
    } else {
      tokenBuy = config.getTokenByAddress(order.tokenB);
    }
    order.tokenS = tokenSell.address;
    order.tokenB = tokenBuy.address;
    order.tokenSId = tokenSell.id;
    order.tokenBId = tokenBuy.id;

    order.amountSInBN = config.toWEI(tokenSell.symbol, order.amountS);
    order.amountS = order.amountSInBN.toString(10);

    order.amountBInBN = config.toWEI(tokenBuy.symbol, order.amountB);
    order.amountB = order.amountBInBN.toString(10);

    order.exchangeId =
      order.exchangeId !== undefined
        ? order.exchangeId
        : config.getExchangeId();
    order.buy = order.buy !== undefined ? order.buy : false;

    order.maxFeeBips =
      order.maxFeeBips !== undefined
        ? order.maxFeeBips
        : config.getMaxFeeBips();
    order.allOrNone = order.allOrNone !== undefined ? order.allOrNone : false;

    order.feeBips =
      order.feeBips !== undefined ? order.feeBips : order.maxFeeBips;
    order.rebateBips = order.rebateBips !== undefined ? order.rebateBips : 0;
    order.label = order.label !== undefined ? order.label : config.getLabel();

    assert(order.maxFeeBips < 64, "maxFeeBips >= 64");
    assert(order.feeBips < 64, "feeBips >= 64");
    assert(order.rebateBips < 64, "rebateBips >= 64");
    assert(order.label < 2 ** 16, "order.label >= 2**16");

    // Sign the order
    return this.signOrder(order);
  }

  public getRandomInt(max: number) {
    return Math.floor(Math.random() * max);
  }

  public submitOrder(wallet: WalletAccount, request: OrderRequest) {
    this.currentWalletAccount = wallet;
    return this.setupOrder(request);
  }

  public signCancel(cancel: CancelRequest) {
    if (cancel.signature !== undefined) {
      return;
    }
    const account = cancel.account;
    const hasher = Poseidon.createHash(9, 6, 53);

    // Calculate hash
    const inputs = [
      config.getExchangeId(),
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
    cancel.signature = EdDSA.sign(account.keyPair.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, cancel.signature, [
      account.keyPair.publicKeyX,
      account.keyPair.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
    return cancel;
  }

  public submitCancel(cancel: CancelRequest) {
    let orderToken, feeToken;
    if (!cancel.orderToken.startsWith("0x")) {
      orderToken = config.getTokenBySymbol(cancel.orderToken);
    } else {
      orderToken = config.getTokenByAddress(cancel.orderToken);
    }
    if (!cancel.tokenF.startsWith("0x")) {
      feeToken = config.getTokenBySymbol(cancel.tokenF);
    } else {
      feeToken = config.getTokenByAddress(cancel.tokenF);
    }
    cancel.tokenFId = feeToken.id;
    cancel.tokenF = feeToken.symbol;
    cancel.orderTokenId = orderToken.id;
    cancel.orderToken = orderToken.symbol;

    cancel.amountFInBN = config.toWEI(feeToken.symbol, cancel.amountF);
    cancel.amountF = cancel.amountFInBN.toString(10);

    cancel.label =
      cancel.label !== undefined ? cancel.label : config.getLabel();
    return this.signCancel(cancel);
  }

  public submitFlexCancel(request: FlexCancelRequest) {
    if (request.signature !== undefined) {
      return;
    }
    const account = request.account;
    let sign = new SignFlexCancelRequest();
    sign.accountId = account.accountId;
    sign.orderHash = request.orderHash;
    sign.clientOrderId = request.clientOrderId;
    const hash = fm.addHexPrefix(sha256(JSON.stringify(sign)).toString());

    // Create signature
    request.signature = EdDSA.sign(account.keyPair.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, request.signature, [
      account.keyPair.publicKeyX,
      account.keyPair.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
    return request;
  }

  public signGetApiKey(request: GetAPIKeyRequest) {
    if (request.signature !== undefined) {
      return;
    }
    let account = request.account;
    let sign = new SignAPIKeyRequest();
    sign.accountId = account.accountId;
    sign.publicKeyX = account.keyPair.publicKeyX;
    sign.publicKeyY = account.keyPair.publicKeyY;
    const hash = fm.addHexPrefix(sha256(JSON.stringify(sign)).toString());

    // Create signature
    request.signature = EdDSA.sign(account.keyPair.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, request.signature, [
      account.keyPair.publicKeyX,
      account.keyPair.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
    return request;
  }
}

export const exchange: Exchange = new Exchange();
