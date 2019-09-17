import { exchange } from "..";
import * as fm from "../lib/wallet/common/formatter";
import config from "../lib/wallet/config";
import Contracts from "../lib/wallet/ethereum/contracts/Contracts";

import Transaction from "../lib/wallet/ethereum/transaction";
import { WalletAccount } from "../lib/wallet/ethereum/walletAccount";
import { OrderInfo } from "../model/types";

export class Account {
  public account: WalletAccount;

  public constructor(account) {
    this.account = account;
  }

  /**
   * Approve
   * @param symbol: approve token symbol
   * @param amount: number amount to approve, e.g. 1.5
   * @param nonce: Ethereum nonce of this address
   * @param gasPrice: gas price in gwei
   */
  public async approve(
    symbol: string,
    amount: number,
    nonce: number,
    gasPrice: number
  ) {
    const token = config.getTokenBySymbol(symbol);
    const rawTx = new Transaction({
      to: token.address,
      value: "0x0",
      data: Contracts.ERC20Token.encodeInputs("approve", {
        _spender: config.getExchangeAddress(),
        _value: amount
      }),
      chainId: config.getChainId(),
      nonce: fm.toHex(nonce),
      gasPrice: fm.toHex(fm.fromGWEI(gasPrice)),
      gasLimit: fm.toHex(config.getGasLimitByType("approve").gasInWEI)
    });
    return this.account.signEthereumTx(rawTx.raw);
  }

  /**
   * create Or Update Account in DEX
   * @param gasPrice: in gwei
   * @param nonce: Ethereum nonce of this address
   * @param password: user password
   */
  public async createOrUpdateAccount(
    password: string,
    nonce: number,
    gasPrice: number
  ) {
    try {
      const createOrUpdateAccountResposne = await exchange.createOrUpdateAccount(
        this.account,
        password,
        nonce,
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
   * @param symbol: string symbol of token to deposit
   * @param amount: string number amount to deposit, e.g. '1.5'
   * @param nonce: Ethereum nonce of this address
   * @param gasPrice: gas price in gwei
   */
  public async depositTo(
    symbol: string,
    amount: string,
    nonce: number,
    gasPrice: number
  ) {
    try {
      const rawTx = await exchange.deposit(
        this.account,
        symbol,
        amount,
        nonce,
        gasPrice
      );
      return this.account.signEthereumTx(rawTx.raw);
    } catch (e) {
      throw e;
    }
  }

  /**
   * Withdraw from Dex
   * @param symbol: string symbol of token to withdraw
   * @param amount: string number amount to withdraw, e.g. '1.5'
   * @param nonce: Ethereum nonce of this address
   * @param gasPrice: gas price in gwei
   */
  public async withdrawFrom(
    symbol: string,
    amount: string,
    nonce: number,
    gasPrice: number
  ) {
    try {
      const rawTx = await exchange.withdraw(
        this.account,
        symbol,
        amount,
        nonce,
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
   * @param amountS: amount of token sell, in string number
   * @param amountB: amount of token buy, in string number
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
    amountS: string,
    amountB: string,
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

      let tokenSell = config.getTokenBySymbol(tokenS);
      let tokenBuy = config.getTokenBySymbol(tokenB);
      let bigNumber = fm.toBig(amountS).times("1e" + tokenSell.digits);
      order.amountSInBN = fm.toBN(bigNumber);
      bigNumber = fm.toBig(amountB).times(fm.toBig("1e" + tokenBuy.digits));
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
