import { EdDSA } from "../lib/sign/eddsa";
import { ethereum } from "../lib/wallet";
import { performance } from "perf_hooks";
import * as fm from "../lib/wallet/common/formatter";
import config from "../lib/wallet/config";
import Transaction from "../lib/wallet/ethereum/transaction";
import { updateHost } from "../lib/wallet/ethereum/utils";
import { WalletAccount } from "../lib/wallet/ethereum/walletAccount";
import { OrderInfo, WithdrawalRequest } from "../model/types";
import * as Poseidon from "../lib/sign/poseidon";

const assert = require("assert");

export class Exchange {
  private currentWalletAccount: WalletAccount;

  // Init when web app launches
  private hasInitialized: boolean;
  public contractURL: string;

  public constructor() {
    this.hasInitialized = false;
  }

  public async init(contractURL: string) {
    console.log("init exchange");
    updateHost(contractURL);
    this.contractURL = contractURL;
    this.hasInitialized = true;
  }

  private checkIfInitialized() {
    if (this.hasInitialized === false) {
      console.warn("lightcone_v3.js is not initialized yet");
      throw "lightcone_v3.js is not initialized yet";
    }
  }

  public async createOrUpdateAccount(
    wallet: WalletAccount,
    password: string,
    gasPrice: number
  ) {
    try {
      this.checkIfInitialized();
      const keyPair = EdDSA.generateKeyPair(wallet.getAddress() + password);
      this.currentWalletAccount = wallet;
      const transaction = await this.createAccountAndDeposit(
        keyPair.publicKeyX,
        keyPair.publicKeyY,
        "",
        "0",
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
          gasLimit: fm.toHex(config.getGasLimitByType("withdrawFrom").gasInWEI)
        });
      }
    } catch (err) {
      console.error("Failed in method withdraw. Error: ", err);
      throw err;
    }
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
      withdrawal.tokenID,
      withdrawal.amount,
      withdrawal.feeTokenID,
      withdrawal.fee,
      withdrawal.label,
      account.nonce
    ];
    const hash = hasher(inputs).toString(10);

    // Create signature
    withdrawal.signature = EdDSA.sign(account.keyPair.secretKey, hash);

    // Verify signature
    const success = EdDSA.verify(hash, withdrawal.signature, [
      account.keyPair.publicKeyX,
      account.keyPair.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
  }

  public signOrder(order: OrderInfo) {
    if (order.signature !== undefined) {
      return;
    }
    const account = order.account;
    const hasher = Poseidon.createHash(14, 6, 53);

    // Calculate hash
    const startHash = performance.now();
    const inputs = [
      config.getExchangeId(),
      order.orderId,
      account.accountId,
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
    const endHash = performance.now();
    console.log("Hash order time: " + (endHash - startHash));

    // Create signature
    const startSign = performance.now();
    order.signature = EdDSA.sign(account.keyPair.secretKey, order.hash);
    const endSign = performance.now();
    console.log("Sign order time: " + (endSign - startSign));

    // Verify signature
    const startVerify = performance.now();
    const success = EdDSA.verify(order.hash, order.signature, [
      account.keyPair.publicKeyX,
      account.keyPair.publicKeyY
    ]);
    assert(success, "Failed to verify signature");
    const endVerify = performance.now();
    console.log("Verify order signature time: " + (endVerify - startVerify));
    return order;
  }

  public async setupOrder(order: OrderInfo) {
    const tokenBuy = config.getTokenBySymbol(order.tokenB);
    const tokenSell = config.getTokenBySymbol(order.tokenS);

    if (!order.tokenS.startsWith("0x")) {
      order.tokenS = tokenSell.address;
    }
    if (!order.tokenB.startsWith("0x")) {
      order.tokenB = tokenBuy.address;
    }
    order.tokenSId = tokenSell.id;
    order.tokenBId = tokenBuy.id;

    let bigNumber = fm.toBig(order.amountS).times("1e" + tokenSell.digits);
    order.amountSInBN = fm.toBN(bigNumber);
    bigNumber = fm.toBig(order.amountB).times("1e" + tokenBuy.digits);
    order.amountBInBN = fm.toBN(bigNumber);

    order.exchangeId =
      order.exchangeId !== undefined
        ? order.exchangeId
        : config.getExchangeId();
    order.buy = order.buy !== undefined ? order.buy : false;

    order.maxFeeBips =
      order.maxFeeBips !== undefined
        ? order.maxFeeBips
        : config.getMaxFeeBips();
    order.allOrNone = order.allOrNone ? order.allOrNone : false;

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

  public async submitOrder(wallet: WalletAccount, orderInfo: OrderInfo) {
    this.currentWalletAccount = wallet;
    return await this.setupOrder(orderInfo);
  }

  public async cancelOrder(orderInfo: OrderInfo) {}

  private getAddress() {
    return this.currentWalletAccount.getAddress();
  }
}

export const exchange: Exchange = new Exchange();
