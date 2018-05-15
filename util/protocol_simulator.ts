import { BigNumber } from "bignumber.js";
import { ChainReader } from "./chain_reader";
import { Order } from "./order";
import { Ring } from "./ring";
import { BalanceItem, FeeItem, RingBalanceInfo, SimulatorReport, TransferItem } from "./types";

export class ProtocolSimulator {
  public ring: Ring;
  public lrcAddress: string;
  public walletSplitPercentage: number;

  public feeSelectionList: number[];
  public chainReader: ChainReader;
  public ringBalanceInfoBefore: RingBalanceInfo;
  public verbose: boolean;

  private spendableAmountSList: number[] = [];
  private spendableLrcAmountList: number[] = [];
  private orderFilledOrCancelledAmountList: number[] = [];

  constructor(ring: Ring,
              lrcAddress: string,
              walletSplitPercentage: number) {
    this.ring = ring;
    this.lrcAddress = lrcAddress;
    this.walletSplitPercentage = walletSplitPercentage;

    this.feeSelectionList = ring.feeSelections;
    this.chainReader = new ChainReader();
  }

  public async simulateAndReport(spendableAmountSList: number[],
                                 spendableLrcAmountList: number[],
                                 orderFilledOrCancelledAmountList: number[],
                                 loadDataFromChain: boolean,
                                 printReport: boolean) {
    if (loadDataFromChain) {
      await this.loadChainData();
    } else {
      this.spendableAmountSList = spendableAmountSList;
      this.spendableLrcAmountList = spendableLrcAmountList;
      this.orderFilledOrCancelledAmountList = orderFilledOrCancelledAmountList;
    }

    this.scaleRing();
    const rateAmountSList = this.caculateRateAmountS();
    const fillAmountSList = this.caculateFillAmountS(rateAmountSList);
    const feeItems = this.caculateOrderFees(fillAmountSList, rateAmountSList);

    const transferList = this.assembleTransferItems(fillAmountSList, feeItems);

    const result: SimulatorReport = {
      ring: this.ring,
      fillAmountS: fillAmountSList,
      transferList,
    };

    if (printReport) {
      this.printSimulatorReport(result);
    }

    return result;
  }

  private async loadChainData() {
    if (!this.chainReader.isConnected()) {
      return;
    }

    const orderOwners = this.ring.orders.map((o) => o.owner);
    const orderAndRingOwners = orderOwners.concat(this.ring.owner);
    let delegateAddr = "";

    for (let i = 0; i < orderOwners.length; i++) {
      const tokenAddr = this.ring.orders[i].params.tokenS;
      if (!delegateAddr) {
        delegateAddr = this.ring.orders[i].params.delegateContract;
      }
      const spendableAmount = await this.chainReader.getERC20TokenSpendable(tokenAddr,
                                                                            orderOwners[i],
                                                                            delegateAddr);
      this.spendableAmountSList.push(spendableAmount);

      const orderHash = this.ring.orders[i].params.orderHashHex;
      const cancelOrFillAmount = await this.chainReader.
        getOrderCancelledOrFilledAmount(orderHash, delegateAddr);
      this.orderFilledOrCancelledAmountList.push(cancelOrFillAmount);
    }

    for (const addr of orderAndRingOwners) {
      const spendableAmount = await this.chainReader.getERC20TokenSpendable(this.lrcAddress,
                                                                            addr,
                                                                            delegateAddr);
      this.spendableLrcAmountList.push(spendableAmount);
    }
  }

  private printSimulatorReport(report: SimulatorReport) {
    console.log("report:", report);
  }

  private caculateRateAmountS() {
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
        availableAmountB -= this.orderFilledOrCancelledAmountList[i];
        availableAmountS = availableAmountB * amountS / amountB;
      } else {
        availableAmountS -= this.orderFilledOrCancelledAmountList[i];
        availableAmountB = availableAmountS * amountB / amountS;
      }

      if (this.spendableAmountSList &&
          this.spendableAmountSList[i] &&
          this.spendableAmountSList[i] < availableAmountS) {
        availableAmountS = this.spendableAmountSList[i];
        availableAmountB = availableAmountS * amountB / amountS;
      }

      if (availableAmountS <= 0 || availableAmountB <= 0) {
        throw new Error("order amountS or amountB is zero");
      }

      order.params.scaledAmountS = availableAmountS;
      order.params.scaledAmountB = availableAmountB;
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
      const walletAddr = order.params.walletAddr;

      if (walletAddr.length > 0) {
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

    feeTotals[this.lrcAddress] = this.sumFeeItem(feeTotals, this.lrcAddress, this.spendableLrcAmountList[size]);

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

    let minerSpendableLrc = this.spendableLrcAmountList[size];
    // caculate fees for each order. and assemble result.
    for (let i = 0; i < size; i++) {
      const nextInd = (i + 1) % size;
      const order = this.ring.orders[i];

      const feeItem: FeeItem = {
        feeS: 0,
        feeB: 0,
        feeLrc: 0,
        lrcReward: 0,
      };

      if (order.params.lrcFee.toNumber() === 0) {
        this.feeSelectionList[i] = 1;
        order.params.marginSplitPercentage = 100;
      }

      if (order.params.tokenB === this.lrcAddress) {
        this.spendableLrcAmountList[i] += fillAmountSList[nextInd];
      }

      if (this.spendableLrcAmountList[i] === 0) {
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

      if (this.spendableLrcAmountList[i] < feeLrcToPay) {
        feeLrcToPay = this.spendableLrcAmountList[i];
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

  private assembleTransferItems(fillAmountSList: number[], feeItems: FeeItem[]) {
    const orderOwners = this.ring.orders.map((o) => o.owner);
    const ringSize = orderOwners.length;
    const transferItems: TransferItem[] = [];
    for (let i = 0; i < ringSize; i++) {
      const nextIndex = (i + 1) % ringSize;
      const descriptions = ["order transfer",
                          "margin split tokenS to miner",
                          "margin split tokenS to wallet",
                          "margin split tokenB to miner",
                          "margin split tokenB to wallet",
                          "lrc fee to miner",
                          "lrc fee to wallet",
                          "lrc reward from miner to order owner"];
      const tokenS = this.ring.orders[i].params.tokenS;
      const tokenB = this.ring.orders[i].params.tokenB;
      const walletAddr = this.ring.orders[i].params.walletAddr;
      const tokenAddressList = [tokenS, tokenS, tokenS, tokenB, tokenB,
                                this.lrcAddress, this.lrcAddress, this.lrcAddress];
      const fromAddressList = [orderOwners[i], orderOwners[i], orderOwners[i], orderOwners[i],
                               orderOwners[i], orderOwners[i], orderOwners[i], this.ring.owner];
      const toAddressList = [orderOwners[nextIndex], this.ring.owner, walletAddr, this.ring.owner,
                             walletAddr, this.ring.owner, walletAddr, orderOwners[i]];

      const feeItem = feeItems[i];
      const amountList = [fillAmountSList[i],
                          feeItem.feeS * (100 - this.walletSplitPercentage) / 100,
                          feeItem.feeS * this.walletSplitPercentage / 100,
                          feeItem.feeB * (100 - this.walletSplitPercentage) / 100,
                          feeItem.feeB * this.walletSplitPercentage / 100,
                          feeItem.feeLrc * (100 - this.walletSplitPercentage) / 100,
                          feeItem.feeLrc * this.walletSplitPercentage / 100,
                          feeItem.lrcReward];

      for (let j = 0; j < amountList.length; j++) {
        if (amountList[j] > 0) {
          const fromAddress = fromAddressList[j];
          const toAddress = toAddressList[j];
          if (fromAddress === toAddress) {
            continue;
          }

          const transferItem: TransferItem = {
            description: descriptions[j],
            tokenAddress: tokenAddressList[j],
            tokenSymbol: "",
            fromAddress,
            toAddress,
            amount: amountList[j],
          };
          transferItems.push(transferItem);
        }
      }
    }

    return transferItems;
  }

  // The balance of tokenS of this.ring.orders[i].owner is this.spendableAmountSList[i].
  // private caculateTraderTokenBalances(fees: FeeItem[], fillAmountSList: number[]) {
  //   const size = this.ring.orders.length;
  //   const balances: BalanceItem[] = [];
  //   for (let i = 0; i < size; i++) {
  //     const order = this.ring.orders[i];
  //     const nextInd = (i + 1) % size;

  //     let balanceSBefore = order.params.amountS.toNumber();
  //     if (this.spendableAmountSList) {
  //       balanceSBefore = this.spendableAmountSList[i];
  //     }

  //     const balanceItem: BalanceItem = {
  //       balanceB: fillAmountSList[nextInd] - fees[i].feeB,
  //       balanceS: balanceSBefore - fillAmountSList[i] - fees[i].feeS,
  //     };

  //     if (order.params.tokenS === this.lrcAddress && 0 === this.feeSelectionList[i]) {
  //       balanceItem.balanceS -= fees[i].feeLrc;
  //     }

  //     if (order.params.tokenB === this.lrcAddress && 0 === this.feeSelectionList[i]) {
  //       balanceItem.balanceB -= fees[i].feeLrc;
  //     }

  //     balances.push(balanceItem);
  //   }
  //   return balances;
  // }

}
