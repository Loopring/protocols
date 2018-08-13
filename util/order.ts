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
    const argsPart1 = [
      order.owner,
      order.tokenS,
      order.tokenB,
      this.toBN(order.amountS),
      this.toBN(order.amountB),
      order.dualAuthAddr ? order.dualAuthAddr : "0x0",
      order.broker ? order.broker : "0x0",
      order.orderInterceptor ? order.orderInterceptor : "0x0",
      order.walletAddr ? order.walletAddr : "0x0",
      order.validSince ? this.toBN(order.validSince) : this.toBN(0),
      order.validUntil ? this.toBN(order.validUntil) : MAX_UINT,
      order.allOrNone,
    ];
    const argTypesPart1 = [
      "address",
      "address",
      "address",
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
    const orderHashPart1 = ABI.soliditySHA3(argTypesPart1, argsPart1);

    const argsPart2 = [
      order.feeToken ? order.feeToken : this.context.lrcAddress,
      order.feeAmount ? this.toBN(order.feeAmount) : this.toBN(0),
      order.feePercentage ? this.toBN(order.feePercentage) : this.toBN(0),
      order.tokenSFeePercentage ? this.toBN(order.tokenSFeePercentage) : this.toBN(0),
      order.tokenBFeePercentage ? this.toBN(order.tokenBFeePercentage) : this.toBN(0),
    ];
    const argTypesPart2 = [
      "address",
      "uint256",
      "uint16",
      "uint16",
      "uint16",
    ];
    const orderHashPart2 = ABI.soliditySHA3(argTypesPart2, argsPart2);

    const args = [
      orderHashPart1,
      orderHashPart2,
    ];
    const argTypes = [
      "bytes32",
      "bytes32",
    ];
    const orderHash = ABI.soliditySHA3(argTypes, args);
    return orderHash;
  }

  public async updateStates(orderInfo: OrderInfo) {
    orderInfo.spendableS = await this.getErc20SpendableAmount(orderInfo.tokenS,
                                                              orderInfo.owner,
                                                              this.context.tradeDelegate.address,
                                                              orderInfo.broker,
                                                              orderInfo.brokerInterceptor);

    orderInfo.filledAmountS = await this.context.tradeDelegate.filled("0x" + orderInfo.hash.toString("hex")).toNumber();
    const remaining = orderInfo.amountS - orderInfo.filledAmountS;

    orderInfo.maxAmountS = Math.min(orderInfo.spendableS, remaining);
    orderInfo.maxAmountB = orderInfo.maxAmountS * orderInfo.amountB / orderInfo.amountS;

    orderInfo.spendableFee = await this.getErc20SpendableAmount(orderInfo.feeToken,
                                                                orderInfo.owner,
                                                                this.context.tradeDelegate.address,
                                                                orderInfo.broker,
                                                                orderInfo.brokerInterceptor);
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
      let amount = 0;
      try {
        amount = await this.context.BrokerInterceptorContract.at(brokerInterceptor).getAllowance(
            owner,
            broker,
            tokenAddr,
        );
      } catch {
        amount = 0;
      }
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
