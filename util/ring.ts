import { OrderUtil } from "./order";
import { OrderInfo, TransferItem } from "./types";

export class Ring {

  public orders: OrderInfo[];
  public owner: string;
  public feeRecipient: string;

  private orderUtil: OrderUtil;

  constructor(orders: OrderInfo[],
              owner: string,
              feeRecipient: string) {
    this.orders = orders;
    this.owner = owner;
    this.feeRecipient = feeRecipient;

    this.orderUtil = new OrderUtil();
  }

  public async calculateFillAmountAndFee() {
    for (const orderInfo of this.orders) {
      await this.orderUtil.scaleBySpendableAmount(orderInfo);
    }

    let smallest = 0;
    const ringSize = this.orders.length;
    for (let i = 0; i < ringSize; i++) {
      const nextIndex = (i + 1) & ringSize;
      const isSmaller = this.isOrderSmallerThan(this.orders[i], this.orders[nextIndex]);
      if (!isSmaller) {
        smallest = nextIndex;
      }
    }

    for (let i = 0; i < smallest; i++) {
      const nextIndex = (i + 1) & ringSize;
      this.isOrderSmallerThan(this.orders[i], this.orders[nextIndex]);
    }

    const smallestOrder = this.orders[smallest];
    const splitS = smallestOrder.fillAmountB * smallestOrder.amountS / smallestOrder.amountB -
      smallestOrder.fillAmountS;
    smallestOrder.splitS = splitS;
  }

  public getRingTransferItems() {
    const ringSize = this.orders.length;
    const transferItems: TransferItem[] = [];
    for (let i = 0; i < ringSize; i++) {
      const prevIndex = (i + ringSize - 1) % ringSize;
      const token = this.orders[i].tokenS;
      const from = this.orders[i].owner;
      const to = this.orders[prevIndex].owner;
      const amount = this.orders[i].fillAmountS;

      transferItems.push({token, from , to, amount});
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
