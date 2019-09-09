import Web3 from "web3";

import { exchange } from "..";
import { ethereum } from "../lib/wallet";
import * as fm from "../lib/wallet/common/formatter";
import config from "../lib/wallet/config";
import Contracts from "../lib/wallet/ethereum/contracts/Contracts";

import Eth from "../lib/wallet/ethereum/eth";
import Transaction from "../lib/wallet/ethereum/transaction";
import { MetaMaskAccount } from "../lib/wallet/ethereum/walletAccount";
import { OrderInfo } from "../model/types";

export class MetaMask {
  public web3: Web3;
  public address: string;
  public ethNode: Eth;
  public account: MetaMaskAccount;

  public constructor(web3, account) {
    this.web3 = web3;
    this.account = new MetaMaskAccount(web3, account, account);
    this.address = account;
  }

  public getAddress() {
    return this.account.getAddress();
  }

  /**
   * Approve
   * @param symbol approve token symbol
   * @param amount number amount to approve, e.g. 1.5
   * @param gasPrice in gwei
   */
  public async approve(symbol: string, amount: number, gasPrice: number) {
    const token = config.getTokenBySymbol(symbol);
    const rawTx = new Transaction({
      to: token.address,
      value: "0x0",
      data: Contracts.ERC20Token.encodeInputs("approve", {
        _spender: "0x3d88d9C4adC342cEff41855CF540844268390BE6", // TODO
        _value: amount
      }),
      chainId: config.getChainId(),
      nonce: fm.toHex(await ethereum.wallet.getNonce(this.getAddress())),
      gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
      gasLimit: fm.toHex(config.getGasLimitByType("approve").gasLimit)
    });
    return this.account.signEthereumTx(rawTx.raw);
  }

  /**
   * create Or Update Account in DEX
   * @param gasPrice: in gwei
   * @param password: user password
   */
  public async createOrUpdateAccount(password: string, gasPrice: number) {
    try {
      const createOrUpdateAccountResposne = await exchange.createOrUpdateAccount(
        this.account,
        password,
        gasPrice
      );
      const rawTx = createOrUpdateAccountResposne["rawTx"];
      const signedEthereumTx = await this.account.signEthereumTx(rawTx.raw);
      return {
        signedTx: signedEthereumTx,
        keyPair: createOrUpdateAccountResposne["keyPair"]
      };
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
      return this.account.signEthereumTx(rawTx.raw);
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
      return this.account.signEthereumTx(rawTx.raw);
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

      let bigNumber = fm.toBig(amountS).times(fm.toBig(1000000000000000000));
      order.amountSInBN = fm.toBN(bigNumber);
      bigNumber = fm.toBig(amountB).times(fm.toBig(1000000000000000000));
      order.amountBInBN = fm.toBN(bigNumber);
      order.amountS = order.amountSInBN.toString(10);
      order.amountB = order.amountBInBN.toString(10);

      order.orderId = orderId;
      order.validSince = Math.floor(validSince);
      order.validUntil = Math.floor(validUntil);
      return exchange.submitOrder(this.account, order);
    } catch (e) {
      throw e;
    }
  }
}
