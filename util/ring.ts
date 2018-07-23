import ABI = require("ethereumjs-abi");
import { Bitstream } from "./bitstream";
import { OrderUtil } from "./order";
import { OrderInfo, TransferItem } from "./types";

export class Ring {

  public orders: OrderInfo[];
  public owner: string;
  public feeRecipient: string;
  public hash?: Buffer;
  public valid: boolean;

  private orderUtil: OrderUtil;

  constructor(orders: OrderInfo[],
              owner: string,
              feeRecipient: string) {
    this.orders = orders;
    this.owner = owner;
    this.feeRecipient = feeRecipient;
    this.valid = true;

    this.orderUtil = new OrderUtil();
  }

  public updateHash() {
    const orderHashes = new Bitstream();
    for (const order of this.orders) {
      orderHashes.addHex(order.hash.toString("hex"));
    }
    this.hash = ABI.soliditySHA3(["bytes"], [Buffer.from(orderHashes.getData().slice(2), "hex")]);
  }

  public checkOrdersValid() {
    for (const order of this.orders) {
      if (!order.valid) {
        return false;
      }
    }
    return true;
  }

  public async calculateFillAmountAndFee() {
    for (const orderInfo of this.orders) {
      await this.orderUtil.scaleBySpendableAmount(orderInfo);
    }

    let smallest = 0;
    const ringSize = this.orders.length;
    for (let i = 0; i < ringSize; i++) {
      const nextIndex = (i + 1) % ringSize;
      const isSmaller = this.isOrderSmallerThan(this.orders[i], this.orders[nextIndex]);
      if (!isSmaller) {
        smallest = nextIndex;
      }
    }

    for (let i = 0; i < smallest; i++) {
      const nextIndex = (i + 1) % ringSize;
      this.isOrderSmallerThan(this.orders[i], this.orders[nextIndex]);
    }

    const smallestOrder = this.orders[smallest];
    const splitS = smallestOrder.fillAmountB * smallestOrder.amountS / smallestOrder.amountB -
      smallestOrder.fillAmountS;
    smallestOrder.splitS = splitS;
  }

  public getRingTransferItems(walletSplitPercentage: number) {
    if (walletSplitPercentage > 100 && walletSplitPercentage < 0) {
      throw new Error("invalid walletSplitPercentage:" + walletSplitPercentage);
    }

    const ringSize = this.orders.length;
    const transferItems: TransferItem[] = [];
    for (let i = 0; i < ringSize; i++) {
      const prevIndex = (i + ringSize - 1) % ringSize;
      const currOrder = this.orders[i];
      const token = currOrder.tokenS;
      const from = currOrder.owner;
      const to = this.orders[prevIndex].owner;
      const amount = currOrder.fillAmountS;

      transferItems.push({token, from , to, amount});

      if (walletSplitPercentage > 0 && currOrder.walletAddr) {
        if (currOrder.fillAmountLrcFee > 0) {
          const lrcFeeToMiner = Math.floor(currOrder.fillAmountLrcFee * walletSplitPercentage / 100);
          const lrcFeeToWallet = currOrder.fillAmountLrcFee - lrcFeeToMiner;
          transferItems.push({token, from , to: this.feeRecipient, amount: lrcFeeToMiner});
          transferItems.push({token, from , to: currOrder.walletAddr, amount: lrcFeeToMiner});
        }

        if (currOrder.splitS > 0) {
          const splitSToMiner = Math.floor(currOrder.splitS * walletSplitPercentage / 100);
          const splitSToWallet = currOrder.splitS - splitSToMiner;
          transferItems.push({token, from , to: this.feeRecipient, amount: splitSToMiner});
          transferItems.push({token, from , to: currOrder.walletAddr, amount: splitSToWallet});
        }
      } else {
        transferItems.push({token, from , to: this.feeRecipient, amount: currOrder.fillAmountLrcFee});
        if (currOrder.splitS > 0) {
          transferItems.push({token, from , to: this.feeRecipient, amount: currOrder.splitS});
        }
      }

    }

    return transferItems;
  }

  private isOrderSmallerThan(o1: OrderInfo, o2: OrderInfo) {
    o1.fillAmountB = o1.fillAmountS * o1.amountB / o1.amountS;
    if (o1.fillAmountB < o2.fillAmountS) {
      o2.fillAmountS = o1.fillAmountB;
      return true;
    } else {
      return false;
    }
  }

}
