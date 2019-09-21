import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import ABI = require("ethereumjs-abi");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { getEIP712Message } from "./eip712";
import { ensure } from "./ensure";
import { MultiHashUtil } from "./multihash";
import { OrderInfo, Spendable, TokenType  } from "./types";

export class OrderUtil {

  private context: Context;

  private zeroBytes32 = "0x" + "0".repeat(64);

  constructor(context: Context) {
    this.context = context;
  }

  async updateBrokerAndInterceptor(order: OrderInfo) {
    if (!order.broker) {
       order.broker = order.owner;
    } else {
      const returnValue = await this.context.orderBrokerRegistry.methods.getBroker(
        order.owner,
        order.broker,
      ).call();
      order.valid = order.valid && ensure(returnValue.registered, "order broker is not registered");
      // order.brokerInterceptor =
      //   (brokerInterceptor === "0x0000000000000000000000000000000000000000") ?
      //   undefined : returnValue.brokerInterceptor;
    }
  }

  async validateInfo(order: OrderInfo) {
    let valid = true;
    valid = valid && ensure(order.version === 0, "unsupported order version");
    valid = valid && ensure(order.owner ? true : false, "invalid order owner");
    valid = valid && ensure(order.tokenS ? true : false, "invalid order tokenS");
    valid = valid && ensure(order.tokenB ? true : false, "invalid order tokenB");
    valid = valid && ensure(order.amountS !== 0, "invalid order amountS");
    valid = valid && ensure(order.amountB !== 0, "invalid order amountB");
    valid = valid && ensure(order.waiveFeePercentage <= this.context.feePercentageBase, "invalid waive percentage");
    valid = valid && ensure(order.waiveFeePercentage >= -this.context.feePercentageBase, "invalid waive percentage");
    valid = valid && ensure(order.tokenSFeePercentage < this.context.feePercentageBase, "invalid tokenS percentage");
    valid = valid && ensure(order.tokenBFeePercentage < this.context.feePercentageBase, "invalid tokenB percentage");
    valid = valid && ensure(order.walletSplitPercentage <= 100, "invalid wallet split percentage");
    if (order.dualAuthAddr) {
      valid = valid && ensure(order.dualAuthSig && order.dualAuthSig.length > 0, "missing dual author signature");
    }

    const blockTimestamp = this.context.blockTimestamp;
    valid = valid && ensure(order.validSince <= blockTimestamp, "order is too early to match");
    valid = valid && ensure(order.validUntil ? order.validUntil > blockTimestamp : true, "order is expired");

    // We only support ERC20 for now
    // valid = valid && ensure(
    //   (order.tokenTypeS === TokenType.ERC20 && order.trancheS === this.zeroBytes32),
    //   "invalid trancheS",
    // );
    // valid = valid && ensure(
    //   (order.tokenTypeB === TokenType.ERC20 && order.trancheB === this.zeroBytes32),
    //   "invalid trancheB",
    // );
    valid = valid && ensure(
      (order.tokenTypeFee === TokenType.ERC20),
      "invalid tokenTypeFee",
    );
    // valid = valid && ensure(
    //   (order.tokenTypeS === TokenType.ERC20 && order.transferDataS === "0x"),
    //   "invalid transferDataS",
    // );
    // This emulates the revert in solidity with invalid enum values
    assert(order.tokenTypeS < TokenType.COUNT, "invalid opcode");
    assert(order.tokenTypeB < TokenType.COUNT, "invalid opcode");
    assert(order.tokenTypeFee < TokenType.COUNT, "invalid opcode");

    order.valid = order.valid && valid;
  }

  validateAllOrNone(order: OrderInfo) {
    order.valid = order.valid && ensure(order.filledAmountS.eq(order.amountS), "allOrNone not completely filled");
  }

  async checkBrokerSignature(order: OrderInfo) {
    let signatureValid = true;
    // If the order was already partially filled we don't have to check the signature again
    if (order.filledAmountS.gt(0)) {
      signatureValid = true;
    } else if (!order.sig) {
      const orderHashHex = "0x" + order.hash.toString("hex");
      const isRegistered = await this.context.orderRegistry.methods.isOrderHashRegistered(order.broker,
                                                                                          orderHashHex).call();
      const isOnchainOrder = await this.context.orderBook.methods.orderSubmitted(orderHashHex).call();
      signatureValid = isRegistered || isOnchainOrder;
    } else {
      const multiHashUtil = new MultiHashUtil();
      signatureValid = multiHashUtil.verifySignature(order.broker, order.hash, order.sig);
    }
    order.valid = order.valid && ensure(signatureValid, "invalid order signature");
  }

  checkDualAuthSignature(order: OrderInfo, miningHash: Buffer) {
    if (order.dualAuthSig) {
      const multiHashUtil = new MultiHashUtil();
      const signatureValid = multiHashUtil.verifySignature(order.dualAuthAddr, miningHash, order.dualAuthSig);
      order.valid = order.valid && ensure(signatureValid, "invalid order dual auth signature");
    }
  }

  toTypedData(order: OrderInfo) {
    const typedData = {
      types: {
          EIP712Domain: [
              { name: "name", type: "string" },
              { name: "version", type: "string" },
          ],
          Order: [
              { name: "amountS", type: "uint" },
              { name: "amountB", type: "uint" },
              { name: "feeAmount", type: "uint" },
              { name: "validSince", type: "uint" },
              { name: "validUntil", type: "uint" },
              { name: "owner", type: "address" },
              { name: "tokenS", type: "address" },
              { name: "tokenB", type: "address" },
              { name: "dualAuthAddr", type: "address" },
              { name: "broker", type: "address" },
              { name: "orderInterceptor", type: "address" },
              { name: "wallet", type: "address" },
              { name: "tokenRecipient", type: "address" },
              { name: "feeToken", type: "address" },
              { name: "walletSplitPercentage", type: "uint16" },
              { name: "tokenSFeePercentage", type: "uint16" },
              { name: "tokenBFeePercentage", type: "uint16" },
              { name: "allOrNone", type: "bool" },
              { name: "tokenTypeS", type: "uint8" },
              { name: "tokenTypeB", type: "uint8" },
              { name: "tokenTypeFee", type: "uint8" },
              { name: "trancheS", type: "bytes32" },
              { name: "trancheB", type: "bytes32" },
              { name: "transferDataS", type: "bytes" },
          ],
      },
      primaryType: "Order",
      domain: {
          name: "Loopring Protocol",
          version: "2",
      },
      message: {
        amountS: this.toBN(order.amountS),
        amountB: this.toBN(order.amountB),
        feeAmount: this.toBN(order.feeAmount),
        validSince: order.validSince ? this.toBN(order.validSince) : this.toBN(0),
        validUntil: order.validUntil ? this.toBN(order.validUntil) : this.toBN(0),
        owner: order.owner,
        tokenS: order.tokenS,
        tokenB: order.tokenB,
        dualAuthAddr: order.dualAuthAddr ? order.dualAuthAddr : "",
        broker: order.broker ? order.broker : "",
        orderInterceptor: order.orderInterceptor ? order.orderInterceptor : "",
        wallet: order.walletAddr ? order.walletAddr : "",
        tokenRecipient: order.tokenRecipient,
        feeToken: order.feeToken,
        walletSplitPercentage: order.walletSplitPercentage,
        tokenSFeePercentage: order.tokenSFeePercentage,
        tokenBFeePercentage: order.tokenBFeePercentage,
        allOrNone: order.allOrNone,
        tokenTypeS: order.tokenTypeS ? order.tokenTypeS : TokenType.ERC20,
        tokenTypeB: order.tokenTypeB ? order.tokenTypeB : TokenType.ERC20,
        tokenTypeFee: order.tokenTypeFee ? order.tokenTypeFee : TokenType.ERC20,
        trancheS: order.trancheS ? order.trancheS : "",
        trancheB: order.trancheB ? order.trancheB : "",
        transferDataS: order.transferDataS ? order.transferDataS : "",
      },
    };
    return typedData;
  }

  toTypedDataJSON(order: OrderInfo) {
    // BN outputs hex numbers in toJSON, but signTypedData expects decimal numbers
    const replacer = (key: any, value: any) => {
      if (key === "amountS" || key === "amountB" || key === "feeAmount" ||
          key === "validSince" || key === "validUntil") {
        return "" + parseInt(value, 16);
      }
      return value;
    };
    const typedData = this.toTypedData(order);
    const json = JSON.stringify(typedData, replacer);
    return json;
  }

  getOrderHash(order: OrderInfo) {
    const typedData = this.toTypedData(order);
    const orderHash = getEIP712Message(typedData);
    return orderHash;
  }

  toOrderBookSubmitParams(orderInfo: OrderInfo) {
    const emptyAddr = "0x" + "0".repeat(40);
    const zeroBytes32 = "0x" + "0".repeat(64);

    const data = new Bitstream();
    data.addAddress(orderInfo.owner, 32);
    data.addAddress(orderInfo.tokenS, 32);
    data.addAddress(orderInfo.tokenB, 32);
    data.addNumber(orderInfo.amountS, 32);
    data.addNumber(orderInfo.amountB, 32);
    data.addNumber(orderInfo.validSince, 32);
    data.addAddress(orderInfo.broker ? orderInfo.broker : emptyAddr, 32);
    data.addAddress(orderInfo.orderInterceptor ? orderInfo.orderInterceptor : emptyAddr, 32);

    data.addAddress(orderInfo.walletAddr ? orderInfo.walletAddr : emptyAddr, 32);
    data.addNumber(orderInfo.validUntil ? orderInfo.validUntil : 0, 32);
    data.addNumber(orderInfo.allOrNone ? 1 : 0, 32);
    data.addAddress(orderInfo.feeToken ? orderInfo.feeToken : emptyAddr, 32);
    data.addNumber(orderInfo.feeAmount ? orderInfo.feeAmount : 0, 32);
    data.addNumber(orderInfo.tokenSFeePercentage ? orderInfo.tokenSFeePercentage : 0, 32);
    data.addNumber(orderInfo.tokenBFeePercentage ? orderInfo.tokenBFeePercentage : 0, 32);
    data.addAddress(orderInfo.tokenRecipient ? orderInfo.tokenRecipient : orderInfo.owner, 32);
    data.addNumber(orderInfo.walletSplitPercentage ? orderInfo.walletSplitPercentage : 0, 32);
    data.addNumber(orderInfo.tokenTypeS ? orderInfo.tokenTypeS : TokenType.ERC20, 32);
    data.addNumber(orderInfo.tokenTypeB ? orderInfo.tokenTypeB : TokenType.ERC20, 32);
    data.addNumber(orderInfo.tokenTypeFee ? orderInfo.tokenTypeFee : TokenType.ERC20, 32);
    data.addHex(orderInfo.trancheS ? orderInfo.trancheS : zeroBytes32);
    data.addHex(orderInfo.trancheB ? orderInfo.trancheB : zeroBytes32);
    if (orderInfo.transferDataS) {
      data.addNumber((orderInfo.transferDataS.length - 2) / 2, 32);
      data.addHex(orderInfo.transferDataS);
    } else {
      data.addNumber(0, 32);
    }

    return data.getData();
  }

  checkP2P(orderInfo: OrderInfo) {
    orderInfo.P2P = (orderInfo.tokenSFeePercentage > 0 || orderInfo.tokenBFeePercentage > 0);
  }

  async getSpendableS(order: OrderInfo) {
    const spendable = await this.getSpendable(order.tokenS,
                                              order.owner,
                                              order.broker,
                                              order.brokerInterceptor,
                                              order.tokenSpendableS,
                                              order.brokerSpendableS);
    return spendable;
  }

  async getSpendableFee(order: OrderInfo) {
    const spendable = await this.getSpendable(order.feeToken,
                                              order.owner,
                                              order.broker,
                                              order.brokerInterceptor,
                                              order.tokenSpendableFee,
                                              order.brokerSpendableFee);
    return spendable;
  }

  async reserveAmountS(order: OrderInfo,
                              amount: BigNumber) {
    const spendableS = await this.getSpendableS(order);
    assert(spendableS.gte(amount), "spendableS >= reserve amount");
    order.tokenSpendableS.reserved = order.tokenSpendableS.reserved.plus(amount);
    if (order.brokerInterceptor) {
      order.brokerSpendableS.reserved = order.brokerSpendableS.reserved.plus(amount);
    }
  }

  async reserveAmountFee(order: OrderInfo,
                                amount: BigNumber) {
    assert((await this.getSpendableFee(order)).gte(amount), "spendableFee >= reserve amount");
    order.tokenSpendableFee.reserved = order.tokenSpendableFee.reserved.plus(amount);
    if (order.brokerInterceptor) {
      order.brokerSpendableFee.reserved = order.brokerSpendableFee.reserved.plus(amount);
    }
  }

  resetReservations(order: OrderInfo) {
    order.tokenSpendableS.reserved = new BigNumber(0);
    order.tokenSpendableFee.reserved = new BigNumber(0);
    if (order.brokerInterceptor) {
      order.tokenSpendableS.reserved = new BigNumber(0);
      order.tokenSpendableFee.reserved = new BigNumber(0);
    }
  }

  async getERC20Spendable(spender: string,
                                 tokenAddress: string,
                                 owner: string) {
    const token = this.context.ERC20Contract;
    token.options.address = tokenAddress;
    const balance = await token.methods.balanceOf(owner).call();
    const allowance = await token.methods.allowance(owner, spender).call();
    const spendable = BigNumber.min(balance, allowance);
    return new BigNumber(spendable.toString());
  }

  async getBrokerAllowance(tokenAddr: string,
                                  owner: string,
                                  broker: string,
                                  brokerInterceptor: string) {
    try {
      return await this.context.BrokerInterceptorContract.at(brokerInterceptor).getAllowance(
          owner,
          broker,
          tokenAddr,
      );
    } catch {
      return new BigNumber(0);
    }
  }

  private async getSpendable(token: string,
                             owner: string,
                             broker: string,
                             brokerInterceptor: string,
                             tokenSpendable: Spendable,
                             brokerSpendable: Spendable) {
    if (!tokenSpendable.initialized) {
      tokenSpendable.amount = await this.getERC20Spendable(this.context.tradeDelegate.options.address,
                                                           token,
                                                           owner);
      tokenSpendable.initialized = true;
      // Testing
      tokenSpendable.initialAmount = tokenSpendable.amount;
    }
    let spendable = tokenSpendable.amount.minus(tokenSpendable.reserved);
    assert(spendable.gte(0), "spendable >= 0");
    if (brokerInterceptor) {
      if (!brokerSpendable.initialized) {
        brokerSpendable.amount = await this.getBrokerAllowance(token,
                                                                  owner,
                                                                  broker,
                                                                  brokerInterceptor);
        brokerSpendable.initialized = true;
        // Testing
        brokerSpendable.initialAmount = brokerSpendable.amount;
      }
      const brokerSpendableAmount = brokerSpendable.amount.minus(brokerSpendable.reserved);
      assert(brokerSpendableAmount.gte(0), "brokerSpendable >= 0");
      spendable = (brokerSpendableAmount.lt(spendable)) ? brokerSpendableAmount : spendable;
    }
    return spendable;
  }

  private toBN(n: number) {
    return new BN((new BigNumber(n)).toString(10), 10);
  }
}
