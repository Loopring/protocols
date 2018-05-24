import { BigNumber } from "bignumber.js";
import { LoopringSubmitParams, OrderParams, RingInfo } from "../util/types";
import { Order } from "./order";
import { Ring } from "./ring";

export class RingFactory {
  public delegateContractAddr: string;
  public currBlockTimeStamp: number;
  public authAddress: string;
  public walletAddr: string;

  constructor(delegateContractAddr: string,
              authAddress: string,
              currBlockTimeStamp: number) {
    this.delegateContractAddr = delegateContractAddr;
    this.authAddress = authAddress;
    this.currBlockTimeStamp = currBlockTimeStamp;
  }

  public async generateRing(ringInfo: RingInfo) {
    const ringSize = ringInfo.amountSList.length;
    const salt = ringInfo.salt ? ringInfo.salt : 0;

    const orders: Order[] = [];
    for (let i = 0; i < ringSize; i ++) {
      const nextIndex = (i + 1) % ringSize;

      const orderParam: OrderParams = {
        delegateContract: this.delegateContractAddr,
        tokenS: ringInfo.tokenAddressList[i],
        tokenB: ringInfo.tokenAddressList[nextIndex],
        amountS: new BigNumber(ringInfo.amountSList[i]),
        amountB: new BigNumber(ringInfo.amountBList[i]),
        validSince: new BigNumber(this.currBlockTimeStamp - 60),
        validUntil: new BigNumber(this.currBlockTimeStamp + 3600 + salt),
        lrcFee: new BigNumber(ringInfo.lrcFeeAmountList[i]),
        buyNoMoreThanAmountB: ringInfo.buyNoMoreThanAmountBList[i],
        marginSplitPercentage: ringInfo.marginSplitPercentageList[i],
        authAddr: this.authAddress,
        walletAddr: this.walletAddr,
      };

      const order = new Order(ringInfo.orderOwners[i], orderParam);
      await order.signAsync();
      orders.push(order);
    }

    const ring = new Ring(ringInfo.miner, orders, ringInfo.feeSelections);
    await ring.signAsync();

    return ring;
  }

  public ringToSubmitableParams(ring: Ring) {
    const ringSize = ring.orders.length;
    const addressList: string[][] = [];
    const uintArgsList: BigNumber[][] = [];
    const uint8ArgsList: number[][] = [];
    const buyNoMoreThanAmountBList: boolean[] = [];
    const vList: number[] = [];
    const rList: string[] = [];
    const sList: string[] = [];

    ring.caculateAndSetRateAmount();
    const rateAmountSList = ring.orders.map((o) => new BigNumber(o.params.rateAmountS.toPrecision(15)));

    for (let i = 0; i < ringSize; i++) {
      const order = ring.orders[i];
      const addressListItem = [order.owner,
                               order.params.tokenS,
                               order.params.walletAddr,
                               order.params.authAddr];

      addressList.push(addressListItem);

      const uintArgsListItem = [
        order.params.amountS,
        order.params.amountB,
        order.params.validSince,
        order.params.validUntil,
        order.params.lrcFee,
        rateAmountSList[i],
      ];
      uintArgsList.push(uintArgsListItem);

      const uint8ArgsListItem = [order.params.marginSplitPercentage];

      uint8ArgsList.push(uint8ArgsListItem);

      buyNoMoreThanAmountBList.push(order.params.buyNoMoreThanAmountB);

      vList.push(order.params.v);
      rList.push(order.params.r);
      sList.push(order.params.s);
    }

    vList.push(...ring.authV);
    rList.push(...ring.authR);
    sList.push(...ring.authS);

    // vList.push(ring.v);
    // rList.push(ring.r);
    // sList.push(ring.s);

    const submitParams = {
      addressList,
      uintArgsList,
      uint8ArgsList,
      buyNoMoreThanAmountBList,
      vList,
      rList,
      sList,
      ringOwner: ring.owner,
      feeRecepient: ring.owner,
      feeSelections: this.feeSelectionListToNumber(ring.feeSelections),
    };

    return submitParams;
  }

  public feeSelectionListToNumber(feeSelections: number[]) {
    let res = 0;
    for (let i = 0; i < feeSelections.length; i ++) {
      res += feeSelections[i] << i;
    }

    return res;
  }

}
