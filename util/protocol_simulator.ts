import { BigNumber } from 'bignumber.js';
import { FeeItem, BalanceItem } from '../util/types';
import { Order } from './order';
import { Ring } from './ring';

export class ProtocolSimulator {
  public ring: Ring;
  public lrcAddress: string;
  public feeSelectionList: number[];

  public availableAmountSList: number[];
  public orderCancelled: number[];
  public orderFilled: number[];

  constructor(ring: Ring,
              lrcAddress: string,
              feeSelectionList: number[]) {
    this.ring = ring;
    this.lrcAddress = lrcAddress;
    this.feeSelectionList = feeSelectionList;
  }

  public caculateRateAmountS() {
    let rate: number = 1;
    let result: number[] = [];
    const size = this.ring.orders.length;
    for (let i = 0; i < size; i++) {
      const order = this.ring.orders[i];
      rate = rate * order.params.amountS.toNumber() / order.params.amountB.toNumber();
    }

    rate = Math.pow(rate, -1/size)

    for (let i = 0; i < size; i ++) {
      const order = this.ring.orders[i];
      const rateAmountS = order.params.scaledAmountS * rate;
      result.push(rateAmountS);
    }

    return result;
  }

  public caculateRingFeesAndBalances() {
    this.scaleRing();
    const rateAmountSList = this.caculateRateAmountS();
    const fillAmountSList = this.caculateFillAmountS(rateAmountSList);

    const fees = this.caculateOrderFees(fillAmountSList, rateAmountSList);
    const balances = this.caculateTraderTokenBalances(fees, fillAmountSList);
    const totalFees = this.sumFees(fees);

    let result: any = {};
    result.fees = fees;
    result.balances = balances;
    result.totalFees = totalFees;

    return result;
  }

  private scaleRing() {
    const size = this.ring.orders.length;

    for (let i = 0; i < size; i++) {
      const order = this.ring.orders[i];
      const amountS = order.params.amountS.toNumber();
      const amountB = order.params.amountB.toNumber();
      let lrcFee = order.params.lrcFee.toNumber();
      let availableAmountS = amountS;
      let availableAmountB = amountB;

      if (order.params.buyNoMoreThanAmountB) {
        if (this.orderFilled && this.orderFilled[i]) {
          availableAmountB -= this.orderFilled[i];
        }
        if (this.orderCancelled && this.orderCancelled[i]) {
          availableAmountB -= this.orderCancelled[i];
        }
        availableAmountS = availableAmountB * amountS / amountB;
      } else {
        if (this.orderFilled && this.orderFilled[i]) {
          availableAmountS -= this.orderFilled[i];
        }
        if (this.orderCancelled && this.orderCancelled[i]) {
          availableAmountS -= this.orderCancelled[i];
        }
        availableAmountB = availableAmountS * amountB / amountS;
      }

      if (this.availableAmountSList && this.availableAmountSList[i] &&
          this.availableAmountSList[i] < availableAmountS) {
        availableAmountS = this.availableAmountSList[i];
        availableAmountB = availableAmountS * amountB / amountS;
      }

      if (availableAmountS <= 0 || availableAmountB <= 0) {
        throw new Error("order amountS or amountB is zero");
      }

      order.params.scaledAmountS = availableAmountS;
      order.params.scaledAmountB =  availableAmountB;
      order.params.lrcFee = new BigNumber(lrcFee.toPrecision(15));
    }
  }

  private caculateFillAmountS(rateAmountSList: number[]) {
    const size = this.ring.orders.length;
    const fillAmountSList: number[] = rateAmountSList.slice();

    for (let i = 0; i < size; i++) {
      const nextIndex = (i + 1) % size;
      const currentOrder = this.ring.orders[i];
      const currentFillAmountS = fillAmountSList[i];
      const currentRateAmountS = rateAmountSList[i];
      const nextOrder = this.ring.orders[nextIndex];
      const nextRateAmountS = rateAmountSList[nextIndex];

      const nextFillAmountS = this.caculateNextFillAmountS(currentOrder,
                                                           currentRateAmountS,
                                                           currentFillAmountS,
                                                           nextOrder,
                                                           nextRateAmountS);

      fillAmountSList[nextIndex] = nextFillAmountS;
    }

    // do it again.
    for (let i = 0; i < size; i++) {
      const nextIndex = (i + 1) % size;
      const currentOrder = this.ring.orders[i];
      const currentFillAmountS = fillAmountSList[i];
      const currentRateAmountS = rateAmountSList[i];
      const nextOrder = this.ring.orders[nextIndex];
      const nextRateAmountS = rateAmountSList[nextIndex];

      const nextFillAmountS = this.caculateNextFillAmountS(currentOrder,
                                                           currentRateAmountS,
                                                           currentFillAmountS,
                                                           nextOrder,
                                                           nextRateAmountS);

      fillAmountSList[nextIndex] = nextFillAmountS;
    }
    return fillAmountSList;
  }

  private caculateNextFillAmountS(currentOrder: Order,
                                  currentRateAmountS: number,
                                  currentFillAmountS: number,
                                  nextOrder: Order,
                                  nextRateAmountS: number) {

    let currentFillAmountB = currentFillAmountS * currentOrder.params.scaledAmountB / currentRateAmountS;

    let nextFillAmountS = nextRateAmountS;
    if (!nextOrder.params.buyNoMoreThanAmountB) {
      nextFillAmountS = nextOrder.params.scaledAmountS;
    }

    if (currentFillAmountB <= nextFillAmountS) {
      return currentFillAmountB;
    } else {
      return nextFillAmountS;
    }
  }

  private sumFees(fees: FeeItem[]) {
    const size = this.ring.orders.length;
    let feeTotals: any = {};
    for (let i = 0; i < size; i++) {
      const order = this.ring.orders[i];
      const feeItem = fees[i];
      const tokenS = order.params.tokenS;
      const tokenB = order.params.tokenB;

      feeTotals[this.lrcAddress] = this.sumFeeItem(feeTotals, this.lrcAddress, feeItem.feeLrc);
      feeTotals[tokenS] = this.sumFeeItem(feeTotals, tokenS, feeItem.feeS);
      feeTotals[tokenB] = this.sumFeeItem(feeTotals, tokenB, feeItem.feeB);
    }

    return feeTotals;
  }

  private sumFeeItem(feeTotals: any, tokenAddress: string, itemAmount: number) {
    if (feeTotals[tokenAddress]) {
      return feeTotals[tokenAddress] + itemAmount;
    } else {
      return itemAmount;
    }
  }

  private caculateOrderFees(fillAmountSList: number[], rateAmountSList: number[]) {
    const size = this.ring.orders.length;
    let fees: FeeItem[] = [];

    // caculate fees for each order. and assemble result.
    for (let i = 0; i < size; i++) {
      const nextInd = (i+1) % size;
      const order = this.ring.orders[i];

      let feeItem: FeeItem = {
        fillAmountS: fillAmountSList[i],
        feeLrc: 0,
        feeS: 0,
        feeB: 0,
      };

      if (0 == this.feeSelectionList[i]) {
        feeItem.feeLrc = order.params.lrcFee.toNumber() * fillAmountSList[i] / order.params.amountS.toNumber();
      } else if (1 == this.feeSelectionList[i]) {
        if (order.params.buyNoMoreThanAmountB) {
          feeItem.feeS = fillAmountSList[i] * order.params.scaledAmountS / rateAmountSList[i] - fillAmountSList[i];
          feeItem.feeS = feeItem.feeS * order.params.marginSplitPercentage / 100;
        } else {
          feeItem.feeB = fillAmountSList[nextInd] - fillAmountSList[i] * order.params.amountB.toNumber() / order.params.amountS.toNumber();
          feeItem.feeB = feeItem.feeB * order.params.marginSplitPercentage / 100;
        }
      } else {
        throw new Error("invalid fee selection value.");
      }

      fees.push(feeItem);
    }

    return fees;
  }

  // assume that the balance of tokenS of this.ring.orders[i].owner == this.ring.orders[i].params.amountS
  private caculateTraderTokenBalances(fees: FeeItem[], fillAmountSList: number[]) {
    const size = this.ring.orders.length;
    let balances: BalanceItem[] = [];
    for (let i = 0; i < size; i++) {
      const order = this.ring.orders[i];
      const nextInd = (i + 1) % size;

      const balanceItem: BalanceItem = {
        balanceS: order.params.amountS.toNumber() - fillAmountSList[i] - fees[i].feeS,
        balanceB: fillAmountSList[nextInd] - fees[i].feeB,
      };

      balances.push(balanceItem);
    }
    return balances;
  }

}
