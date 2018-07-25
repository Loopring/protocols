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
      // order.broker = order.owner;
    } else {
      // const [registered, brokerInterceptor] = this.BrokerRegistryContract.getBroker(
      //   order.owner,
      //   order.broker,
      // );
      // assert(registered, "broker unregistered");
      // order.brokerInterceptor = brokerInterceptor;
    }
  }

  public async checkBrokerSignature(order: OrderInfo) {
    if (!order.sig) {
      return this.context.orderRegistry.isOrderHashRegistered(order.broker, order.hash);
    } else {
      return this.multiHashUtil.verifySignature(order.broker, order.hash, order.sig);
    }
  }

  public checkDualAuthSignature(order: OrderInfo, miningHash: Buffer) {
    if (order.dualAuthSig) {
      return this.multiHashUtil.verifySignature(order.dualAuthAddr, miningHash, order.dualAuthSig);
    } else {
      return true;
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
                                                          this.context.tradeDelegate.address);

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
                                        spender: string) {
    const token = this.context.ERC20Contract.at(tokenAddr);
    const balance = await token.balanceOf(owner);
    const allowance = await token.allowance(owner, spender);
    return Math.min(balance, allowance);
  }

  private toBN(n: number) {
    return new BN((new BigNumber(n)).toString(10), 10);
  }
}
