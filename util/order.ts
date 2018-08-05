import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import ABI = require("ethereumjs-abi");
import { Context } from "./context";
import { MultiHashUtil } from "./multihash";
import { OrderInfo } from "./types";

export class OrderUtil {

  private context: Context;
  private multiHashUtil = new MultiHashUtil();

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
      order.valid = order.valid && registered;
      order.brokerInterceptor =
        (brokerInterceptor === "0x0000000000000000000000000000000000000000") ? undefined : brokerInterceptor;
    }
  }

  public async validateInfo(order: OrderInfo) {
    let valid = true;
    valid = valid && (order.owner ? true : false); // invalid order owner
    valid = valid && (order.tokenS ? true : false); // invalid order tokenS
    valid = valid && (order.tokenB ? true : false); // invalid order tokenB
    valid = valid && (order.amountS !== 0); // invalid order amountS
    valid = valid && (order.amountB !== 0); // invalid order amountB

    const blockTimestamp = this.context.blockTimestamp;
    valid = valid && (order.validSince <= blockTimestamp); // order is too early to match
    valid = valid && (order.validUntil ? order.validUntil > blockTimestamp : true);  // order is expired

    order.valid = order.valid && valid;
  }

  public async checkBrokerSignature(order: OrderInfo) {
    let signatureValid = true;
    if (!order.sig) {
      signatureValid = await this.context.orderRegistry.isOrderHashRegistered(order.broker, order.hash);
    } else {
      signatureValid = this.multiHashUtil.verifySignature(order.broker, order.hash, order.sig);
    }
    order.valid = order.valid && signatureValid;
  }

  public checkDualAuthSignature(order: OrderInfo, miningHash: Buffer) {
    if (order.dualAuthSig) {
      const signatureValid = this.multiHashUtil.verifySignature(order.dualAuthAddr, miningHash, order.dualAuthSig);
      order.valid = order.valid && signatureValid;
    }
  }

  public getOrderHash(order: OrderInfo) {
    const MAX_UINT = new BN("f".repeat(64), 16);
    const args = [
      order.owner,
      order.tokenS,
      order.tokenB,
      this.toBN(order.amountS),
      this.toBN(order.amountB),
      this.toBN(order.lrcFee),
      order.dualAuthAddr ? order.dualAuthAddr : "0x0",
      order.broker ? order.broker : "0x0",
      order.orderInterceptor ? order.orderInterceptor : "0x0",
      order.walletAddr ? order.walletAddr : "0x0",
      order.validSince ? this.toBN(order.validSince) : this.toBN(0),
      order.validUntil ? this.toBN(order.validUntil) : MAX_UINT,
      order.allOrNone,
    ];

    const argTypes = [
      "address",
      "address",
      "address",
      "uint256",
      "uint256",
      "uint256",
      "address",
      "address",
      "address",
      "address",
      "uint256",
      "uint256",
      "bool",
    ];
    const orderHash = ABI.soliditySHA3(argTypes, args);
    return orderHash;
  }

  public async scaleBySpendableAmount(orderInfo: OrderInfo) {
    const spendableS = await this.getErc20SpendableAmount(orderInfo.tokenS,
                                                          orderInfo.owner,
                                                          this.context.tradeDelegate.address,
                                                          orderInfo.broker,
                                                          orderInfo.brokerInterceptor);

    const filled = await this.context.tradeDelegate.filled(orderInfo.hash.toString("hex"));
    const remaining = orderInfo.amountS - filled;

    if (remaining <= 0) {
      throw new Error("order had been fully filled.");
    }
    orderInfo.fillAmountS = Math.min(spendableS, remaining);
    orderInfo.fillAmountLrcFee = orderInfo.lrcFee * orderInfo.fillAmountS / orderInfo.amountS;
  }

  private async getErc20SpendableAmount(tokenAddr: string,
                                        owner: string,
                                        spender: string,
                                        broker: string,
                                        brokerInterceptor: string) {
    const token = this.context.ERC20Contract.at(tokenAddr);
    const balance = await token.balanceOf(owner);
    const allowance = await token.allowance(owner, spender);
    let spendable = Math.min(balance, allowance);

    if (brokerInterceptor && broker !== owner) {
      const amount = await this.context.BrokerInterceptorContract.at(brokerInterceptor).getAllowance(
          owner,
          broker,
          tokenAddr,
      );
      if (amount < spendable) {
          spendable = amount;
      }
    }

    return spendable;
  }

  private toBN(n: number) {
    return new BN((new BigNumber(n)).toString(10), 10);
  }
}
