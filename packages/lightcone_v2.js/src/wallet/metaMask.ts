import Web3 from "web3";

import Eth from "../lib/wallet/ethereum/eth";
import Transaction from "../lib/wallet/ethereum/transaction";
import { MetaMaskAccount } from "../lib/wallet/ethereum/walletAccount";
import { fromMetaMask } from "../lib/wallet/WalletUtils";
import { exchange } from "..";

export class MetaMask {
  public web3: Web3;
  public address: string;
  public ethNode: Eth;
  public account: MetaMaskAccount;

  public constructor(web3, account) {
    this.web3 = web3;
    this.account = account;
    this.address = account;
    this.ethNode = new Eth("http://localhost:8545"); // TODO: config
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
}
