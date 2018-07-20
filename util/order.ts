import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import ABI = require("ethereumjs-abi");
import fs = require("fs");
import { OrderInfo } from "./types";

export class OrderUtil {
  private ERC20Contract: any;
  private DelegateContract: any;

  constructor() {
    const erc20Abi = fs.readFileSync("ABI/latest/ERC20.abi", "ascii");
    const delegateAbi = fs.readFileSync("ABI/latest/ITradeDelegate.abi", "ascii");
    this.ERC20Contract = web3.eth.contract(JSON.parse(erc20Abi));
    this.DelegateContract = web3.eth.contract(JSON.parse(delegateAbi));
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
      order.validSince ? order.validSince : this.toBN(0),
      order.validUntil ? order.validUntil : MAX_UINT,
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
                                                          orderInfo.delegateContract);

    const delegateContract = this.DelegateContract.at(orderInfo.delegateContract);
    const filled = await delegateContract.filled(orderInfo.hash.toString("hex"));
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
    const token = this.ERC20Contract.at(tokenAddr);
    const balance = await token.balanceOf(owner);
    const allowance = await token.allowance(owner, spender);
    return Math.min(balance, allowance);
  }

  private toBN(n: number) {
    return new BN((new BigNumber(n)).toString(10), 10);
  }
}
