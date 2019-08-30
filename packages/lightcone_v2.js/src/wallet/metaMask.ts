import Web3 from "web3";

import { exchange } from "..";
import * as fm from "../lib/wallet/common/formatter";

import Eth from "../lib/wallet/ethereum/eth";
import { MetaMaskAccount } from "../lib/wallet/ethereum/walletAccount";
import { OrderInfo } from "../model/types";

export class MetaMask {
  public web3: Web3;
  public address: string;
  public ethNode: Eth;
  public account: MetaMaskAccount;

  public constructor(web3, account) {
    this.web3 = web3;
    this.account = new MetaMaskAccount(web3,account,account);
    this.address = account;
    this.ethNode = new Eth("http://localhost:8545"); // TODO: config
  }


    /**
     * create Or Update Account in DEX
     * @param gasPrice in gwei
     */
    public async createOrUpdateAccount(gasPrice: number) {
        try {
            const rawTx = await exchange.createOrUpdateAccount(
                this.account,
                gasPrice
            );
            return this.account.signEthereumTx(rawTx.raw);
        } catch (e) {
            throw e;
        }
    }

  /**
   * Deposit to Dex
   * @param symbol string symbol of token to deposit
   * @param amount number amount to deposit, e.g. 1.5
   * @param gasPrice in gwei
   */
  public async depositTo(symbol: string, amount: number, gasPrice: number) {
    try {
      const rawTx = await exchange.deposit(
        this.account,
        symbol,
        amount,
        gasPrice
      );
      const signedTx = this.account.signEthereumTx(rawTx.raw);
      const sendTransactionResponse = await this.account.sendTransaction(
        this.ethNode,
        signedTx
      );
      console.log(
        "depositTo sendTransactionResponse:",
        sendTransactionResponse
      );
      return sendTransactionResponse;
    } catch (e) {
      throw e;
    }
  }

  /**
   * Withdraw from Dex
   * @param symbol string symbol of token to withdraw
   * @param amount number amount to withdraw, e.g. 1.5
   * @param gasPrice in gwei
   */
  public async withdrawFrom(symbol: string, amount: number, gasPrice: number) {
    try {
      const rawTx = await exchange.withdraw(
        this.account,
        symbol,
        amount,
        gasPrice
      );
      const signedTx = this.account.signEthereumTx(rawTx.raw);
      const sendTransactionResponse = await this.account.sendTransaction(
        this.ethNode,
        signedTx
      );
      console.log(
        "withdrawFrom sendTransactionResponse:",
        sendTransactionResponse
      );
      return sendTransactionResponse;
    } catch (e) {
      throw e;
    }
  }

  /**
   * Get signed order, should be submitted by frontend itself TEMPORARY
   * @param owner: Ethereum address of this order's owner
   * @param accountId: account ID in exchange
   * @param tokenS: symbol or hex address of token sell
   * @param tokenB: symbol or hex address of token buy
   * @param tokenSId: token sell ID in exchange
   * @param tokenBId: token buy ID in exchange
   * @param tradingPubKeyX: trading public key X of account, decimal string
   * @param tradingPubKeyY: trading public key Y of account, decimal string
   * @param tradingPrivKey: trading private key of account, decimal string
   * @param amountS: amount of token sell, in number
   * @param amountB: amount of token buy, in number
   * @param orderId: next order ID, needed by order signature
   * @param validSince: valid beginning period of this order, SECOND in timestamp
   * @param validUntil: valid ending period of this order, SECOND in timestamp
   */
  public async submitOrder(
    owner: string,
    accountId: number,
    tokenS: string,
    tokenB: string,
    tokenSId: number,
    tokenBId: number,
    tradingPubKeyX: string,
    tradingPubKeyY: string,
    tradingPrivKey: string,
    amountS: number,
    amountB: number,
    orderId: number,
    validSince: number,
    validUntil: number
  ) {
    try {
      const order = new OrderInfo();
      order.owner = owner;
      order.accountId = accountId;
      order.tokenS = tokenS;
      order.tokenB = tokenB;
      order.tokenSId = tokenSId;
      order.tokenBId = tokenBId;
      order.tradingPubKeyX = tradingPubKeyX;
      order.tradingPubKeyY = tradingPubKeyY;
      order.tradingPrivKey = tradingPrivKey;
      order.amountS = fm.toBN("1000000000000000000");
      order.amountB = fm.toBN("100000000000000000000"); // TODO
      order.orderId = orderId;
      order.validSince = Math.floor(validSince);
      order.validUntil = Math.floor(validUntil);
      return exchange.submitOrder(order);
    } catch (e) {
      throw e;
    }
  }
}
