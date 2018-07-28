import ABI = require("ethereumjs-abi");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { OrderUtil } from "./order";
import { OrderInfo, TransferItem } from "./types";

export class Ring {

  public orders: OrderInfo[];
  public owner: string;
  public feeRecipient: string;
  public hash?: Buffer;
  public valid: boolean;

  private context: Context;
  private orderUtil: OrderUtil;

  constructor(context: Context,
              orders: OrderInfo[],
              owner: string,
              feeRecipient: string,
              ) {
    this.context = context;
    this.orders = orders;
    this.owner = owner;
    this.feeRecipient = feeRecipient;
    this.valid = true;

    this.orderUtil = new OrderUtil(context);
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
      this.valid = this.valid && order.valid;
    }
  }

  public async checkTokensRegistered() {
    const tokens: string[] = [];
    for (const order of this.orders) {
      tokens.push(order.tokenS);
    }
    const tokensRegistered = await this.context.tokenRegistry.areAllTokensRegistered(tokens);
    this.valid = this.valid && tokensRegistered;
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

    // This loop could maybe be optimized, but I don't want to pre-optimize it and introduce bugs
    for (let i = 0; i < ringSize; i++) {
      const order = this.orders[i];
      const nextOrder = this.orders[(i + 1) % ringSize];
      if (nextOrder.fillAmountB > order.fillAmountS) {
        // This ring cannot be settled because this order cannot be fulfilled at the requested rate
        this.valid = false;
      } else {
        // We can still decide what we want to do with these extra tokens,
        // but let's give them all to the miner for now
        order.splitS = order.fillAmountS - nextOrder.fillAmountB;
        order.fillAmountS = nextOrder.fillAmountB;
        order.fillAmountLrcFee = Math.floor(order.lrcFee * order.fillAmountB / order.amountB);
      }
    }
/*
    const prevSmallest = (smallest + ringSize - 1) % ringSize;
    const smallestOrder = this.orders[smallest];
    const prevSmallestOrder = this.orders[prevSmallest];

    smallestOrder.fillAmountS = Math.floor(smallestOrder.fillAmountB * smallestOrder.amountS /
                                           smallestOrder.amountB);
    // TODO: I think the following line is incorrect though I'm not sure yet.
    prevSmallestOrder.fillAmountB = smallestOrder.fillAmountS;
    const newFillAmountS = Math.floor(prevSmallestOrder.fillAmountB * prevSmallestOrder.amountS /
                                      prevSmallestOrder.amountB);
    prevSmallestOrder.splitS = newFillAmountS - prevSmallestOrder.fillAmountS;

    for (const orderInfo of this.orders) {
      orderInfo.fillAmountLrcFee = Math.floor(orderInfo.lrcFee * orderInfo.fillAmountB /
                                              orderInfo.amountB);
    }
*/
  }

  public getRingTransferItems(walletSplitPercentage: number) {
    if (walletSplitPercentage > 100 && walletSplitPercentage < 0) {
      throw new Error("invalid walletSplitPercentage:" + walletSplitPercentage);
    }
    if (!this.valid) {
      console.log("Ring cannot be settled!");
      return [];
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

      if (!currOrder.splitS) { // if undefined, then assigned to 0;
        currOrder.splitS = 0;
      }

      console.log("order.amountB:          " + currOrder.amountB);
      console.log("order.amountS:          " + currOrder.amountS);
      console.log("order expected rate:    " + currOrder.amountS / currOrder.amountB);
      console.log("order.fillAmountB:      " + currOrder.fillAmountB);
      console.log("order.fillAmountS:      " + currOrder.fillAmountS);
      console.log("order.splitS:           " + currOrder.splitS);
      console.log("order actual rate:      " + (currOrder.fillAmountS + currOrder.splitS) / currOrder.fillAmountB);
      console.log("order.fillAmountLrcFee: " + currOrder.fillAmountLrcFee);
      console.log("----------------------------------------------");

      // Sanity checks
      assert(currOrder.fillAmountS >= 0, "fillAmountS should be positive");
      assert(currOrder.splitS >= 0, "splitS should be positive");
      assert(currOrder.fillAmountLrcFee >= 0, "fillAmountLrcFee should be positive");
      assert((currOrder.fillAmountS + currOrder.splitS) <= currOrder.amountS, "fillAmountS + splitS <= amountS");
      assert(currOrder.fillAmountS <= currOrder.amountS, "fillAmountS <= amountS");
      assert(currOrder.fillAmountLrcFee <= currOrder.lrcFee, "fillAmountLrcFee <= lrcFee");
      // TODO: can fail if not exactly equal, check with lesser precision
      // assert(currOrder.amountS / currOrder.amountB
      //        === currOrder.fillAmountS / currOrder.fillAmountB, "fill rates need to match order rate");

      transferItems.push({token, from , to, amount});

      if (walletSplitPercentage > 0 && currOrder.walletAddr) {
        if (currOrder.fillAmountLrcFee > 0) {
          const lrcFeeToWallet = Math.floor(currOrder.fillAmountLrcFee * walletSplitPercentage / 100);
          const lrcFeeToMiner = currOrder.fillAmountLrcFee - lrcFeeToWallet;
          transferItems.push({token, from , to: this.feeRecipient, amount: lrcFeeToMiner});
          transferItems.push({token, from , to: currOrder.walletAddr, amount: lrcFeeToMiner});
        }

        if (currOrder.splitS > 0) {
          const splitSToWallet = Math.floor(currOrder.splitS * walletSplitPercentage / 100);
          const splitSToMiner = currOrder.splitS - splitSToWallet;
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
/*
  private isOrderSmallerThan(o1: OrderInfo, o2: OrderInfo) {
    o1.fillAmountB = Math.floor(o1.fillAmountS * o1.amountB / o1.amountS);
    if (o1.fillAmountB < o2.fillAmountS) {
      o2.fillAmountS = o1.fillAmountB;
      return true;
    } else {
      return false;
    }
  }
*/
  private isOrderSmallerThan(current: OrderInfo, next: OrderInfo) {
    next.fillAmountB = next.fillAmountS * next.amountB / next.amountS;
    if (next.fillAmountB > current.fillAmountS) {
      next.fillAmountB = current.fillAmountS;
      next.fillAmountS = Math.floor(next.fillAmountB * next.amountS / next.amountB);
      return true;
    } else {
      return false;
    }
  }

}
