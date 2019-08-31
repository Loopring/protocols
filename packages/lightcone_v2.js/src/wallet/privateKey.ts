// @ts-ignore
import { ethereum } from "../lib/wallet";
import * as fm from "../lib/wallet/common/formatter";
import config from "../lib/wallet/config";
import * as datas from "../lib/wallet/config/data";
import Contracts from "../lib/wallet/ethereum/contracts/Contracts";
import Eth from "../lib/wallet/ethereum/eth";
import Transaction from "../lib/wallet/ethereum/transaction";
import { PrivateKeyAccount } from "../lib/wallet/ethereum/walletAccount";
import { OrderInfo } from "../model/types";
import { exchange } from "../sign/exchange";

export class PrivateKey {
  public account: PrivateKeyAccount;
  public address: string;
  public ethNode: Eth;

  public constructor() {
    this.ethNode = new Eth("http://localhost:8545"); // TODO: config
    // this.account = walletUtil.fromPrivateKey('');
  }

  public getAddress() {
    return this.account.getAddress();
  }

  /**
   * Transfer token
   * @param toAddr string to address
   * @param symbol string symbol of token to transfer
   * @param amount number amount to transfer, e.g. 1.5
   * @param gasPrice in gwei
   */
  public async transfer(
    toAddr: string,
    symbol: string,
    amount: number,
    gasPrice: number
  ) {
    let to, value, data: string;
    const token = config.getTokenBySymbol(symbol);
    value = fm.toHex(fm.toBig(amount).times("1e" + token.digits));
    if (symbol === "ETH") {
      to = toAddr;
      data = fm.toHex("0x");
    } else {
      to = token.address;
      data = ethereum.abi.Contracts.ERC20Token.encodeInputs("transfer", {
        _to: to,
        _value: value
      });
      value = "0x0";
    }
    const rawTx = new Transaction({
      to: to,
      value: value,
      data: data,
      chainId: config.getChainId(),
      nonce: fm.toHex(await ethereum.wallet.getNonce(this.getAddress())),
      gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
      gasLimit: fm.toHex(config.getGasLimitByType("token_transfer").gasLimit) // TODO: new gas limit
    });
    const signedTx = this.account.signEthereumTx(rawTx);

    return this.account.sendTransaction(this.ethNode, signedTx);
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
        _spender: datas.configs.delegateAddress,
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
   * Convert eth -> weth
   * @param amount number amount to deposit, e.g. 1.5
   * @param gasPrice in gwei
   */
  public async deposit(amount: number, gasPrice: number) {
    const weth = config.getTokenBySymbol("WETH");
    const value = fm.toHex(fm.toBig(amount).times(1e18));
    const rawTx = new Transaction({
      to: weth.address,
      value: value,
      data: Contracts.WETH.encodeInputs("deposit", {}),
      chainId: config.getChainId(),
      nonce: fm.toHex(await ethereum.wallet.getNonce(this.getAddress())),
      gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
      gasLimit: fm.toHex(config.getGasLimitByType("deposit").gasLimit)
    });
    const signedTx = this.account.signEthereumTx(rawTx);

    return this.account.sendTransaction(this.ethNode, signedTx);
  }

  /**
   * Convert weth -> eth
   * @param amount number amount to withdraw, e.g. 1.5
   * @param gasPrice in gwei
   */
  public async withdraw(amount: number, gasPrice: number) {
    const weth = config.getTokenBySymbol("WETH");
    const value = fm.toHex(fm.toBig(amount).times(1e18));
    const rawTx = new Transaction({
      to: weth.address,
      value: "0x0",
      data: Contracts.WETH.encodeInputs("withdraw", {
        wad: value
      }),
      chainId: config.getChainId(),
      nonce: fm.toHex(await ethereum.wallet.getNonce(this.getAddress())),
      gasPrice: fm.toHex(fm.toBig(gasPrice).times(1e9)),
      gasLimit: fm.toHex(config.getGasLimitByType("withdraw").gasLimit)
    });
    const signedTx = this.account.signEthereumTx(rawTx);

    return this.account.sendTransaction(this.ethNode, signedTx);
  }

  /**
   * create Or Update Account in DEX
   * @param gasPrice in gwei
   */
  public async createOrUpdateAccount(gasPrice: number) {
    try {
      const createOrUpdateAccountResposne = await exchange.createOrUpdateAccount(
        this.account,
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
      order.amountS = fm.toBN(amountS).mul(fm.toBN(1000000000000000000));
      order.amountB = fm.toBN(amountS).mul(fm.toBN(100000000000000000000)); // TODO
      order.orderId = orderId;
      order.validSince = Math.floor(validSince);
      order.validUntil = Math.floor(validUntil);
      return exchange.submitOrder(order);
    } catch (e) {
      throw e;
    }
  }
}

export const privateKey: PrivateKey = new PrivateKey();
