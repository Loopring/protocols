import { exchange } from "..";
import * as fm from "../lib/wallet/common/formatter";
import config from "../lib/wallet/config";
import Contracts from "../lib/wallet/ethereum/contracts/Contracts";
import Transaction from "../lib/wallet/ethereum/transaction";
import { WalletAccount } from "../lib/wallet/ethereum/walletAccount";
import {
  CancelRequest,
  DexAccount,
  FlexCancelRequest,
  GetAPIKeyRequest,
  KeyPair,
  OrderRequest,
  WithdrawalRequest
} from "../model/types";

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
  public approve(
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
  public createOrUpdateAccount(
    password: string,
    nonce: number,
    gasPrice: number
  ) {
    try {
      const createOrUpdateAccountResposne = exchange.createOrUpdateAccount(
        this.account,
        password,
        nonce,
        gasPrice
      );
      const rawTx = createOrUpdateAccountResposne["rawTx"];
      const signedEthereumTx = this.account.signEthereumTx(rawTx.raw);
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
  public depositTo(
    symbol: string,
    amount: string,
    nonce: number,
    gasPrice: number
  ) {
    try {
      const rawTx = exchange.deposit(
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
   * On-chain Withdrawal from Dex
   * @param symbol: string symbol of token to withdraw
   * @param amount: string number amount to withdraw, e.g. '1.5'
   * @param nonce: Ethereum nonce of this address
   * @param gasPrice: gas price in gwei
   */
  public onchainWithdrawal(
    symbol: string,
    amount: string,
    nonce: number,
    gasPrice: number
  ) {
    try {
      const rawTx = exchange.withdraw(
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
   * Off-chain Withdrawal from Dex
   * @param accountId: account ID in exchange
   * @param tradingPubKeyX: trading public key X of account, decimal string
   * @param tradingPubKeyY: trading public key Y of account, decimal string
   * @param tradingPrivKey: trading private key of account, decimal string
   * @param nonce: DEX nonce of account
   * @param token: token symbol or address to withdraw
   * @param amount: amount to withdraw, in decimal string. e.g. '15'
   * @param tokenF: fee token symbol or address to withdraw
   * @param amountF: withdrawal fee, in decimal string. e.g. '15'
   * @param label: [OPTIONAL] label used in protocol
   */
  public offchainWithdrawal(
    accountId: number,
    tradingPubKeyX: string,
    tradingPubKeyY: string,
    tradingPrivKey: string,
    nonce: number,
    token: string,
    amount: string,
    tokenF: string,
    amountF: string,
    label?: number
  ) {
    try {
      const withdraw = new WithdrawalRequest();
      const account = new DexAccount();
      account.keyPair = new KeyPair();
      withdraw.account = account;
      withdraw.account.accountId = accountId;
      withdraw.account.keyPair.publicKeyX = tradingPubKeyX;
      withdraw.account.keyPair.publicKeyY = tradingPubKeyY;
      withdraw.account.keyPair.secretKey = tradingPrivKey;
      withdraw.account.nonce = nonce;
      withdraw.token = token;
      withdraw.amount = amount;
      withdraw.tokenF = tokenF;
      withdraw.amountF = amountF;
      withdraw.label = label;
      return exchange.submitWithdrawal(withdraw);
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
   * @param tradingPubKeyX: trading public key X of account, decimal string
   * @param tradingPubKeyY: trading public key Y of account, decimal string
   * @param tradingPrivKey: trading private key of account, decimal string
   * @param amountS: amount of token sell, in string number
   * @param amountB: amount of token buy, in string number
   * @param orderId: next order ID, needed by order signature
   * @param validSince: valid beginning period of this order, SECOND in timestamp
   * @param validUntil: valid ending period of this order, SECOND in timestamp
   * @param label: [OPTIONAL] label used in protocol
   */
  public submitOrder(
    owner: string,
    accountId: number,
    tradingPubKeyX: string,
    tradingPubKeyY: string,
    tradingPrivKey: string,
    tokenS: string,
    tokenB: string,
    amountS: string,
    amountB: string,
    orderId: number,
    validSince: number,
    validUntil: number,
    label?: number
  ) {
    try {
      const order = new OrderRequest();
      const account = new DexAccount();
      account.keyPair = new KeyPair();
      order.owner = owner;
      order.account = account;
      order.account.accountId = accountId;
      order.account.keyPair.publicKeyX = tradingPubKeyX;
      order.account.keyPair.publicKeyY = tradingPubKeyY;
      order.account.keyPair.secretKey = tradingPrivKey;

      order.tokenS = tokenS;
      order.tokenB = tokenB;
      order.amountS = amountS;
      order.amountB = amountB;

      order.orderId = orderId;
      order.validSince = Math.floor(validSince);
      order.validUntil = Math.floor(validUntil);
      order.label = label;
      return exchange.submitOrder(this.account, order);
    } catch (e) {
      throw e;
    }
  }

  /**
   * Cancel order in Dex
   * @param accountId: account ID in exchange
   * @param tradingPubKeyX: trading public key X of account, decimal string
   * @param tradingPubKeyY: trading public key Y of account, decimal string
   * @param tradingPrivKey: trading private key of account, decimal string
   * @param nonce: DEX nonce of account
   * @param orderToken: token symbol or address of cancel
   * @param orderId: specified order id to cancel
   * @param tokenF: amountF token symbol or address of cancel
   * @param amountF: cancel amountF, e.g. '15'
   * @param label: [OPTIONAL] label used in protocol
   */
  public submitCancel(
    accountId: number,
    tradingPubKeyX: string,
    tradingPubKeyY: string,
    tradingPrivKey: string,
    nonce: number,
    orderToken: string,
    orderId: number,
    tokenF: string,
    amountF: string,
    label?: number
  ) {
    try {
      const cancel = new CancelRequest();
      const account = new DexAccount();
      account.keyPair = new KeyPair();
      cancel.account = account;
      cancel.account.accountId = accountId;
      cancel.account.keyPair.publicKeyX = tradingPubKeyX;
      cancel.account.keyPair.publicKeyY = tradingPubKeyY;
      cancel.account.keyPair.secretKey = tradingPrivKey;
      cancel.account.nonce = nonce;
      cancel.orderToken = orderToken;
      cancel.orderId = orderId;
      cancel.tokenF = tokenF;
      cancel.amountF = amountF;
      cancel.label = label;
      return exchange.submitCancel(cancel);
    } catch (e) {
      throw e;
    }
  }

  /**
   * Get Api Key signature
   * @param accountId: account ID in exchange
   * @param tradingPubKeyX: trading public key X of account, decimal string
   * @param tradingPubKeyY: trading public key Y of account, decimal string
   * @param tradingPrivKey: trading private key of account, decimal string
   */
  public getApiKey(
    accountId: number,
    tradingPubKeyX: string,
    tradingPubKeyY: string,
    tradingPrivKey: string
  ) {
    try {
      const request = new GetAPIKeyRequest();
      const account = new DexAccount();
      account.keyPair = new KeyPair();
      request.account = account;
      request.account.accountId = accountId;
      request.account.keyPair.publicKeyX = tradingPubKeyX;
      request.account.keyPair.publicKeyY = tradingPubKeyY;
      request.account.keyPair.secretKey = tradingPrivKey;
      return exchange.signGetApiKey(request);
    } catch (e) {
      throw e;
    }
  }

  /**
   * Get Api Key signature
   * @param accountId: account ID in exchange
   * @param tradingPubKeyX: trading public key X of account, decimal string
   * @param tradingPubKeyY: trading public key Y of account, decimal string
   * @param tradingPrivKey: trading private key of account, decimal string
   * @param orderHash: [OPTIONAL] specified order hash to cancel
   * @param clientOrderId: [OPTIONAL] specified client order ID to cancel
   */
  public submitFlexCancel(
    accountId: number,
    tradingPubKeyX: string,
    tradingPubKeyY: string,
    tradingPrivKey: string,
    orderHash?: string,
    clientOrderId?: string
  ) {
    try {
      const request = new FlexCancelRequest();
      const account = new DexAccount();
      account.keyPair = new KeyPair();
      request.account = account;
      request.account.accountId = accountId;
      request.account.keyPair.publicKeyX = tradingPubKeyX;
      request.account.keyPair.publicKeyY = tradingPubKeyY;
      request.account.keyPair.secretKey = tradingPrivKey;
      request.orderHash = orderHash;
      request.clientOrderId = clientOrderId;
      return exchange.submitFlexCancel(request);
    } catch (e) {
      throw e;
    }
  }
}
