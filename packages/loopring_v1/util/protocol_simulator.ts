import { BigNumber } from "bignumber.js";
import { ChainReader } from "./chain_reader";
import { Order } from "./order";
import { Ring } from "./ring";
import { BalanceItem,
         FeeItem,
         RingBalanceInfo,
         SimulatorReport,
         TransferItem } from "./types";

export class ProtocolSimulator {
  public ring: Ring;
  public lrcAddress: string;
  public tokenRegistryAddress: string;
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
              tokenRegistryAddress: string,
              walletSplitPercentage: number) {
    this.ring = ring;
    this.lrcAddress = lrcAddress;
    this.tokenRegistryAddress = tokenRegistryAddress;
    this.walletSplitPercentage = walletSplitPercentage;

    this.feeSelectionList = ring.feeSelections;
    this.chainReader = new ChainReader();
  }

  public async simulateAndReport(spendableAmountSList: number[],
                                 spendableLrcAmountList: number[],
                                 orderFilledOrCancelledAmountList: number[],
                                 printReport: boolean) {
    const ringSize = this.ring.orders.length;
    await this.loadChainData();
    if (spendableAmountSList && spendableAmountSList.length === ringSize) {
      this.spendableAmountSList = spendableAmountSList;
    }
    if (spendableLrcAmountList && spendableLrcAmountList.length === ringSize) {
      this.spendableLrcAmountList = spendableLrcAmountList;
    }
    if (orderFilledOrCancelledAmountList && orderFilledOrCancelledAmountList.length === ringSize) {
      this.orderFilledOrCancelledAmountList = orderFilledOrCancelledAmountList;
    }

    this.ring.caculateAndSetRateAmount();
    this.scaleRing();
    this.caculateFillAmountS();

    const feeItems = this.caculateOrderFees();
    const transferList = this.assembleTransferItems(feeItems);

    const result: SimulatorReport = {
      ring: this.ring,
      feeItems,
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
      const order = this.ring.orders[i];
      const tokenAddr = order.params.tokenS;
      if (!delegateAddr) {
        delegateAddr = order.params.delegateContract;
      }
      const spendableAmount = await this.chainReader.getERC20TokenSpendable(tokenAddr,
                                                                            orderOwners[i],
                                                                            delegateAddr);
      this.spendableAmountSList.push(spendableAmount);

      const orderHash = order.params.orderHashHex;
      const cancelOrFillAmount = await this.chainReader.
        getOrderCancelledOrFilledAmount(orderHash, delegateAddr);
      this.orderFilledOrCancelledAmountList.push(cancelOrFillAmount);

      const symbol = await await this.chainReader.
        getTokenSymbolByAddress(this.tokenRegistryAddress, tokenAddr);
      order.params.tokenSSymbol = symbol;
    }

    for (const addr of orderAndRingOwners) {
      const spendableAmount = await this.chainReader.getERC20TokenSpendable(this.lrcAddress,
                                                                            addr,
                                                                            delegateAddr);
      this.spendableLrcAmountList.push(spendableAmount);
    }
  }

  private printSimulatorReport(report: SimulatorReport) {
    console.log("=".repeat(30), "Simulator Report Begin", "=".repeat(30));
    report.ring.printToConsole();
    console.log("feeItems:", report.feeItems);
    console.log("transferList:", report.transferList);
    console.log("=".repeat(30), " Simulator Report End ", "=".repeat(30));
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
        availableAmountS = Math.floor(availableAmountB * amountS / amountB);
      } else {
        availableAmountS -= this.orderFilledOrCancelledAmountList[i];
        availableAmountB = Math.floor(availableAmountS * amountB / amountS);
      }

      if (this.spendableAmountSList &&
          this.spendableAmountSList[i] &&
          this.spendableAmountSList[i] < availableAmountS) {
        availableAmountS = this.spendableAmountSList[i];
        availableAmountB = Math.floor(availableAmountS * amountB / amountS);
      }

      if (availableAmountS <= 0 || availableAmountB <= 0) {
        throw new Error("order amountS or amountB is zero");
      }

      if (amountS < availableAmountS) {
        availableAmountS = amountS;
        availableAmountB = Math.floor(availableAmountS * amountB / amountS);
      }

      if (amountB < availableAmountB) {
        availableAmountB = amountB;
        availableAmountS = Math.floor(availableAmountB * amountS / amountB);
      }

      order.params.scaledAmountS = availableAmountS;
      order.params.scaledAmountB = availableAmountB;

      order.params.fillAmountS = availableAmountS;
    }
  }

  private caculateFillAmountS() {
    const size = this.ring.orders.length;

    let smallestIndex = 0;
    for (let i = 0; i < size; i++) {
      const nextIndex = (i + 1) % size;
      const currOrder = this.ring.orders[i];
      const nextOrder = this.ring.orders[nextIndex];
      smallestIndex = this.caculateNextFillAmountS(currOrder, nextOrder, smallestIndex, i, nextIndex);
    }

    // do it again.
    for (let i = 0; i < smallestIndex; i++) {
      const nextIndex = (i + 1) % size;
      const currOrder = this.ring.orders[i];
      const nextOrder = this.ring.orders[nextIndex];
      this.caculateNextFillAmountS(currOrder, nextOrder, 0, 0, 0);
    }
  }

  private caculateNextFillAmountS(currOrder: Order,
                                  nextOrder: Order,
                                  smallestIndex: number,
                                  currIndex: number,
                                  nextIndex: number) {
    let newSamllestIndex = smallestIndex;
    let currFillAmountB = currOrder.params.fillAmountS *
      currOrder.params.rateAmountB / currOrder.params.rateAmountS;
    currFillAmountB = Math.floor(currFillAmountB);
    if (currOrder.params.buyNoMoreThanAmountB) {
      if (currFillAmountB > currOrder.params.scaledAmountB) {
        currFillAmountB = currOrder.params.scaledAmountB;
        currOrder.params.fillAmountS = Math.floor(currFillAmountB *
                                                  currOrder.params.rateAmountS /
                                                  currOrder.params.rateAmountB);
        newSamllestIndex = currIndex;
      }
    }

    if (nextOrder.params.fillAmountS >= currFillAmountB) {
      nextOrder.params.fillAmountS = currFillAmountB;
    } else {
      newSamllestIndex = nextIndex;
    }
    return newSamllestIndex;
  }

  private caculateOrderFees() {
    const size = this.ring.orders.length;
    const fillAmountSList = this.ring.orders.map((o) => o.params.fillAmountS);

    const fees: FeeItem[] = [];
    let minerSpendableLrc = this.spendableLrcAmountList[size];

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
        const fillAmountB = Math.floor(fillAmountSList[i] * order.params.rateAmountB / order.params.rateAmountS);
        feeLrcToPay = Math.floor(order.params.lrcFee.toNumber() * fillAmountB /
                                 order.params.amountB.toNumber());
      } else {
        feeLrcToPay = Math.floor(order.params.lrcFee.toNumber() * fillAmountSList[i] /
                                 order.params.amountS.toNumber());
      }

      if (order.params.tokenS === this.lrcAddress) {
        this.spendableLrcAmountList[i] -= fillAmountSList[i];
      }

      if (order.params.tokenB === this.lrcAddress) {
        this.spendableLrcAmountList[i] += fillAmountSList[nextInd];
      }

      if (this.spendableLrcAmountList[i] < feeLrcToPay) {
        feeLrcToPay = this.spendableLrcAmountList[i];
        order.params.marginSplitPercentage = 100;
      }

      if (0 === this.feeSelectionList[i]) {
        feeItem.feeLrc = feeLrcToPay;
        if (order.params.tokenB === this.lrcAddress) {
          if (this.spendableLrcAmountList[i] >= feeLrcToPay) {
            feeItem.feeB = feeLrcToPay;
            feeItem.feeLrc = 0;
          } else {
            feeItem.feeB = this.spendableLrcAmountList[i];
            feeItem.feeLrc = feeLrcToPay - this.spendableLrcAmountList[i];
          }
        }
      } else if (1 === this.feeSelectionList[i]) {
        if (minerSpendableLrc >= feeLrcToPay) {
          if (order.params.buyNoMoreThanAmountB) {
            feeItem.feeS = Math.floor(fillAmountSList[nextInd] *
                                      order.params.amountS.toNumber() /
                                      order.params.amountB.toNumber()) - fillAmountSList[i];
            feeItem.feeS = Math.floor(feeItem.feeS * order.params.marginSplitPercentage / 100);
          } else {
            feeItem.feeB = fillAmountSList[nextInd] -
              Math.floor(fillAmountSList[i] *
                         order.params.amountB.toNumber() /
                         order.params.amountS.toNumber());
            feeItem.feeB = Math.floor(feeItem.feeB * order.params.marginSplitPercentage / 100);
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

  private assembleTransferItems(feeItems: FeeItem[]) {
    const orderOwners = this.ring.orders.map((o) => o.owner);
    const ringSize = orderOwners.length;
    const transferItems: TransferItem[] = [];
    for (let i = 0; i < ringSize; i++) {
      const prevIndex = (i + ringSize - 1) % ringSize;
      const descriptions = ["order transfer",
                          "margin splitS and prev-splitB to miner",
                          "margin splitS and prev-splitB to wallet",
                          "lrc fee to miner",
                          "lrc fee to wallet",
                          "lrc reward from miner to order owner"];
      const tokenS = this.ring.orders[i].params.tokenS;
      const tokenB = this.ring.orders[i].params.tokenB;
      const fillAmountS = this.ring.orders[i].params.fillAmountS;
      const walletAddr = this.ring.orders[i].params.walletAddr;
      const tokenAddressList = [tokenS, tokenS, tokenS,
                                this.lrcAddress, this.lrcAddress, this.lrcAddress];
      const fromAddressList = [orderOwners[i], orderOwners[i], orderOwners[i],
                               orderOwners[i], orderOwners[i], this.ring.owner];
      const toAddressList = [orderOwners[prevIndex], this.ring.owner, walletAddr,
                             this.ring.owner, walletAddr, orderOwners[i]];

      const feeItem = feeItems[i];
      const prevFeeItem = feeItems[prevIndex];

      const walletSplit = Math.floor((feeItem.feeS + prevFeeItem.feeB) * this.walletSplitPercentage / 100);
      const minerSplit = feeItem.feeS + prevFeeItem.feeB - walletSplit;
      const walletLrc = Math.floor(feeItem.feeLrc * this.walletSplitPercentage / 100);
      const minerLrc = feeItem.feeLrc - walletLrc;
      const amountList = [fillAmountS - prevFeeItem.feeB,
                          minerSplit,
                          walletSplit,
                          minerLrc,
                          walletLrc,
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

}
