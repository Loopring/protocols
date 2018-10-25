import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import ABI = require("ethereumjs-abi");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { ensure } from "./ensure";
import { MultiHashUtil } from "./multihash";
import { OrderInfo, Spendable } from "./types";

export class OrderUtil {

  private context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  public async updateBrokerAndInterceptor(order: OrderInfo) {
    if (!order.broker) {
       order.broker = order.owner;
    } else {
      const [registered, brokerInterceptor] = await this.context.orderBrokerRegistry.getBroker(
        order.owner,
        order.broker,
      );
      order.valid = order.valid && ensure(registered, "order broker is not registered");
      // order.brokerInterceptor =
      //   (brokerInterceptor === "0x0000000000000000000000000000000000000000") ? undefined : brokerInterceptor;
    }
  }

  public async validateInfo(order: OrderInfo) {
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

    order.valid = order.valid && valid;
  }

  public validateAllOrNone(order: OrderInfo) {
    order.valid = order.valid && ensure(order.filledAmountS.eq(order.amountS), "allOrNone not completely filled");
  }

  public async checkBrokerSignature(order: OrderInfo) {
    let signatureValid = true;
    // If the order was already partially filled we don't have to check the signature again
    if (order.filledAmountS.gt(0)) {
      signatureValid = true;
    } else if (!order.sig) {
      const orderHashHex = "0x" + order.hash.toString("hex");
      const isRegistered = await this.context.orderRegistry.isOrderHashRegistered(order.broker,
                                                                                  orderHashHex);
      const isOnchainOrder = await this.context.orderBook.orderSubmitted(orderHashHex);
      signatureValid = isRegistered || isOnchainOrder;
    } else {
      const multiHashUtil = new MultiHashUtil();
      signatureValid = multiHashUtil.verifySignature(order.broker, order.hash, order.sig);
    }
    order.valid = order.valid && ensure(signatureValid, "invalid order signature");
  }

  public checkDualAuthSignature(order: OrderInfo, miningHash: Buffer) {
    if (order.dualAuthSig) {
      const multiHashUtil = new MultiHashUtil();
      const signatureValid = multiHashUtil.verifySignature(order.dualAuthAddr, miningHash, order.dualAuthSig);
      order.valid = order.valid && ensure(signatureValid, "invalid order dual auth signature");
    }
  }

  public getOrderHash(order: OrderInfo) {
    const args = [
      this.toBN(order.amountS),
      this.toBN(order.amountB),
      this.toBN(order.feeAmount),
      order.validSince ? this.toBN(order.validSince) : this.toBN(0),
      order.validUntil ? this.toBN(order.validUntil) : this.toBN(0),
      order.owner,
      order.tokenS,
      order.tokenB,
      order.dualAuthAddr ? order.dualAuthAddr : "0x0",
      order.broker ? order.broker : "0x0",
      order.orderInterceptor ? order.orderInterceptor : "0x0",
      order.walletAddr ? order.walletAddr : "0x0",
      order.tokenRecipient,
      order.feeToken,
      order.walletSplitPercentage,
      this.toBN(order.tokenSFeePercentage),
      this.toBN(order.tokenBFeePercentage),
      order.allOrNone,
    ];
    const argTypes = [
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "uint256",
      "address",
      "address",
      "address",
      "address",
      "address",
      "address",
      "address",
      "address",
      "address",
      "uint16",
      "uint16",
      "uint16",
      "bool",
    ];
    const orderHash = ABI.soliditySHA3(argTypes, args);
    return orderHash;
  }

  public toOrderBookSubmitParams(orderInfo: OrderInfo) {
    const emptyAddr = "0x" + "0".repeat(40);

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

    return data.getData();
  }

  public checkP2P(orderInfo: OrderInfo) {
    orderInfo.P2P = (orderInfo.tokenSFeePercentage > 0 || orderInfo.tokenBFeePercentage > 0);
  }

  public async getSpendableS(order: OrderInfo) {
    const spendable = await this.getSpendable(order.tokenS,
                                              order.owner,
                                              order.broker,
                                              order.brokerInterceptor,
                                              order.tokenSpendableS,
                                              order.brokerSpendableS);
    return spendable;
  }

  public async getSpendableFee(order: OrderInfo) {
    const spendable = await this.getSpendable(order.feeToken,
                                              order.owner,
                                              order.broker,
                                              order.brokerInterceptor,
                                              order.tokenSpendableFee,
                                              order.brokerSpendableFee);
    return spendable;
  }

  public async reserveAmountS(order: OrderInfo,
                              amount: BigNumber) {
    const spendableS = await this.getSpendableS(order);
    assert(spendableS.gte(amount), "spendableS >= reserve amount");
    order.tokenSpendableS.reserved = order.tokenSpendableS.reserved.plus(amount);
    if (order.brokerInterceptor) {
      order.brokerSpendableS.reserved = order.brokerSpendableS.reserved.plus(amount);
    }
  }

  public async reserveAmountFee(order: OrderInfo,
                                amount: BigNumber) {
    assert((await this.getSpendableFee(order)).gte(amount), "spendableFee >= reserve amount");
    order.tokenSpendableFee.reserved = order.tokenSpendableFee.reserved.plus(amount);
    if (order.brokerInterceptor) {
      order.brokerSpendableFee.reserved = order.brokerSpendableFee.reserved.plus(amount);
    }
  }

  public resetReservations(order: OrderInfo) {
    order.tokenSpendableS.reserved = new BigNumber(0);
    order.tokenSpendableFee.reserved = new BigNumber(0);
    if (order.brokerInterceptor) {
      order.tokenSpendableS.reserved = new BigNumber(0);
      order.tokenSpendableFee.reserved = new BigNumber(0);
    }
  }

  public async getERC20Spendable(spender: string,
                                 tokenAddress: string,
                                 owner: string) {
    const token = this.context.ERC20Contract.at(tokenAddress);
    const balance = await token.balanceOf(owner);
    const allowance = await token.allowance(owner, spender);
    const spendable = BigNumber.min(balance, allowance);
    return spendable;
  }

  public async getBrokerAllowance(tokenAddr: string,
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
      tokenSpendable.amount = await this.getERC20Spendable(this.context.tradeDelegate.address,
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
