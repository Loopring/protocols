import { BigNumber } from "bignumber.js";
import { BalanceItem, FeeItem } from "../util/types";
import { Order } from "./order";
import { Ring } from "./ring";

export class ProtocolSimulator {
  public ring: Ring;
  public lrcAddress: string;
  public feeSelectionList: number[];

  public availableAmountSList: number[];
  public spendableLrcFeeList: number[];
  public orderCancelled: number[];
  public orderFilled: number[];
  public walletSplitPercentage: number;

  constructor(ring: Ring,
              lrcAddress: string,
              feeSelectionList: number[],
              walletSplitPercentage: number) {
    this.ring = ring;
    this.lrcAddress = lrcAddress;
    this.feeSelectionList = feeSelectionList;
    this.walletSplitPercentage = walletSplitPercentage;
  }

  public caculateRateAmountS() {
    let rate: number = 1;
    const result: number[] = [];
    const size = this.ring.orders.length;
    for (let i = 0; i < size; i++) {
      const order = this.ring.orders[i];
      rate = rate * order.params.amountS.toNumber() / order.params.amountB.toNumber();
    }

    rate = Math.pow(rate, -1 / size);

    for (let i = 0; i < size; i ++) {
      const order = this.ring.orders[i];
      const rateAmountS = order.params.scaledAmountS * rate;
      order.params.rateAmountS = rateAmountS;
      order.params.rateAmountB = order.params.scaledAmountB;
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
    const totalFees = this.sumFees(fees, balances);

    const result: any = {};
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
      const lrcFee = order.params.lrcFee.toNumber();
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

    const currentFillAmountB = currentFillAmountS * currentOrder.params.scaledAmountB / currentRateAmountS;

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

  private sumFees(fees: FeeItem[], balances: BalanceItem[]) {
    const size = this.ring.orders.length;
    const feeTotals: any = {};
    for (let i = 0; i < size; i++) {
      const order = this.ring.orders[i];
      const feeItem = fees[i];
      const balanceItem = balances[i];
      const tokenS = order.params.tokenS;
      const tokenB = order.params.tokenB;
      const walletId = order.params.walletId.toNumber();

      if (walletId > 0) {
        feeItem.feeLrc = feeItem.feeLrc * (100 - this.walletSplitPercentage) / 100;
        feeItem.feeS = feeItem.feeS * (100 - this.walletSplitPercentage) / 100;
        feeItem.feeB = feeItem.feeB * (100 - this.walletSplitPercentage) / 100;
      }

      feeTotals[this.lrcAddress] = this.sumFeeItem(feeTotals, this.lrcAddress, feeItem.feeLrc);
      feeTotals[this.lrcAddress] = this.sumFeeItem(feeTotals,
                                                   this.lrcAddress,
                                                   -feeItem.lrcReward);

      feeTotals[tokenS] = this.sumFeeItem(feeTotals, tokenS, feeItem.feeS);
      feeTotals[tokenB] = this.sumFeeItem(feeTotals, tokenB, feeItem.feeB);
    }

    feeTotals[this.lrcAddress] = this.sumFeeItem(feeTotals, this.lrcAddress, this.spendableLrcFeeList[size]);

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
    const fees: FeeItem[] = [];

    let minerSpendableLrc = this.spendableLrcFeeList[size];
    // caculate fees for each order. and assemble result.
    for (let i = 0; i < size; i++) {
      const nextInd = (i + 1) % size;
      const order = this.ring.orders[i];

      const feeItem: FeeItem = {
        feeB: 0,
        feeLrc: 0,
        feeS: 0,
        lrcReward: 0,
        fillAmountS: fillAmountSList[i],
      };

      if (order.params.lrcFee.toNumber() === 0) {
        this.feeSelectionList[i] = 1;
        order.params.marginSplitPercentage = 100;
      }

      if (order.params.tokenB === this.lrcAddress) {
        this.spendableLrcFeeList[i] += fillAmountSList[nextInd];
      }

      if (this.spendableLrcFeeList[i] === 0) {
        this.feeSelectionList[i] = 1;
        order.params.marginSplitPercentage = 100;
      }

      let feeLrcToPay = 0;
      if (order.params.buyNoMoreThanAmountB) {
        const fillAmountB = fillAmountSList[i] * order.params.rateAmountB / order.params.rateAmountS;
        feeLrcToPay = order.params.lrcFee.toNumber() * fillAmountB / order.params.amountB.toNumber();
      } else {
        feeLrcToPay = order.params.lrcFee.toNumber() * fillAmountSList[i] /
        order.params.amountS.toNumber();
      }

      if (this.spendableLrcFeeList[i] < feeLrcToPay) {
        feeLrcToPay = this.spendableLrcFeeList[i];
        order.params.marginSplitPercentage = 100;
      }

      if (0 === this.feeSelectionList[i]) {
        feeItem.feeLrc = feeLrcToPay;
      } else if (1 === this.feeSelectionList[i]) {
        if (minerSpendableLrc >= feeLrcToPay) {
          if (order.params.buyNoMoreThanAmountB) {
            feeItem.feeS = fillAmountSList[i] * order.params.scaledAmountS / rateAmountSList[i] -
              fillAmountSList[i];
            feeItem.feeS = feeItem.feeS * order.params.marginSplitPercentage / 100;
          } else {
            feeItem.feeB = fillAmountSList[nextInd] -
              fillAmountSList[i] * order.params.amountB.toNumber() / order.params.amountS.toNumber();
            feeItem.feeB = feeItem.feeB * order.params.marginSplitPercentage / 100;
          }

          if (feeItem.feeS > 0 || feeItem.feeB > 0) {
            minerSpendableLrc -= feeLrcToPay;
            feeItem.lrcReward = feeLrcToPay;
          }

          feeItem.feeLrc = 0;
        }
      } else {
        throw new Error("invalid fee selection value.");
      }

      fees.push(feeItem);
    }

    return fees;
  }

  // The balance of tokenS of this.ring.orders[i].owner is this.availableAmountSList[i].
  private caculateTraderTokenBalances(fees: FeeItem[], fillAmountSList: number[]) {
    const size = this.ring.orders.length;
    const balances: BalanceItem[] = [];
    for (let i = 0; i < size; i++) {
      const order = this.ring.orders[i];
      const nextInd = (i + 1) % size;

      let balanceSBefore = order.params.amountS.toNumber();
      if (this.availableAmountSList) {
        balanceSBefore = this.availableAmountSList[i];
      }

      const balanceItem: BalanceItem = {
        balanceB: fillAmountSList[nextInd] - fees[i].feeB,
        balanceS: balanceSBefore - fillAmountSList[i] - fees[i].feeS,
      };

      if (order.params.tokenS === this.lrcAddress && 0 === this.feeSelectionList[i]) {
        balanceItem.balanceS -= fees[i].feeLrc;
      }

      if (order.params.tokenB === this.lrcAddress && 0 === this.feeSelectionList[i]) {
        balanceItem.balanceB -= fees[i].feeLrc;
      }

      balances.push(balanceItem);
    }
    return balances;
  }

}
