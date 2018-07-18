import fs = require("fs");
import { OrderInfo } from "./types";

export class OrderUtil {
  public orderInfo: OrderInfo;

  private ERC20Contract: any;
  private DelegateContract: any;

  constructor() {
    const erc20Abi = fs.readFileSync("ABI/latest/ERC20.abi", "ascii");
    const delegateAbi = fs.readFileSync("ABI/latest/ITradeDelegate.abi", "ascii");
    this.ERC20Contract = web3.eth.contract(JSON.parse(erc20Abi));
    this.DelegateContract = web3.eth.contract(JSON.parse(delegateAbi));
  }

  public async scaleBySpendableAmount(orderInfo: OrderInfo) {
    const spendableS = await this.getErc20SpendableAmount(this.orderInfo.tokenS,
                                                          this.orderInfo.owner,
                                                          this.orderInfo.delegateContract);

    const delegateContract = this.DelegateContract.at(this.orderInfo.delegateContract);
    const filled = await delegateContract.filled(this.orderInfo.orderHashHex);
    const remaining = this.orderInfo.amountS - filled;

    if (remaining <= 0) {
      throw new Error("order had been fully filled.");
    }
    this.orderInfo.fillAmountS = Math.min(spendableS, remaining);
  }

  private async getErc20SpendableAmount(tokenAddr: string,
                                        owner: string,
                                        spender: string) {
    const token = this.ERC20Contract.at(tokenAddr);
    const balance = await token.balanceOf(owner);
    const allowance = await token.allowance(owner, spender);
    return Math.min(balance, allowance);
  }

}
