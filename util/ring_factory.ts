import { BigNumber } from "bignumber.js";
import { LoopringSubmitParams, OrderParams } from "../util/types";
import { Order } from "./order";
import { Ring } from "./ring";

export class RingFactory {
  public loopringProtocolAddr: string;
  public eosAddress: string;
  public neoAddress: string;
  public lrcAddress: string;
  public qtumAddress: string;
  public currBlockTimeStamp: number;
  public authAddress: string;

  constructor(loopringProtocolAddr: string,
              eosAddress: string,
              neoAddress: string,
              lrcAddress: string,
              qtumAddress: string,
              authAddress: string,
              currBlockTimeStamp: number) {
    this.loopringProtocolAddr = loopringProtocolAddr;
    this.eosAddress = eosAddress;
    this.neoAddress = neoAddress;
    this.lrcAddress = lrcAddress;
    this.qtumAddress = qtumAddress;
    this.authAddress = authAddress;
    this.currBlockTimeStamp = currBlockTimeStamp;
  }

  public async generateRingForCancel(order1Owner: string,
                                     order2Owner: string,
                                     ringOwner: string,
                                     minerId: BigNumber,
                                     feeSelections: number[]) {
    const orderPrams1 = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.eosAddress,
      tokenB: this.neoAddress,
      amountS: new BigNumber(1000e18),
      amountB: new BigNumber(100e18),
      validSince: new BigNumber(this.currBlockTimeStamp),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 110),
      lrcFee: new BigNumber(1e18),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 0,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const orderPrams2 = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.neoAddress,
      tokenB: this.eosAddress,
      amountS: new BigNumber(100e18),
      amountB: new BigNumber(1000e18),
      validSince: new BigNumber(this.currBlockTimeStamp),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 120),
      lrcFee: new BigNumber(1e18),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 0,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const order1 = new Order(order1Owner, orderPrams1);
    const order2 = new Order(order2Owner, orderPrams2);
    await order1.signAsync();
    await order2.signAsync();

    const ring = new Ring(ringOwner, [order1, order2], minerId, feeSelections);
    await ring.signAsync();

    return ring;
  }

  public async generateSize2Ring01(order1Owner: string,
                                   order2Owner: string,
                                   ringOwner: string,
                                   minerId: BigNumber,
                                   feeSelections: number[]) {
    const orderPrams1 = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.eosAddress,
      tokenB: this.neoAddress,
      amountS: new BigNumber(1000e18),
      amountB: new BigNumber(100e18),
      validSince: new BigNumber(this.currBlockTimeStamp),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 130),
      lrcFee: new BigNumber(10e18),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 0,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const orderPrams2 = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.neoAddress,
      tokenB: this.eosAddress,
      amountS: new BigNumber(100e18),
      amountB: new BigNumber(1000e18),
      validSince: new BigNumber(this.currBlockTimeStamp),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 140),
      lrcFee: new BigNumber(5e18),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 0,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const order1 = new Order(order1Owner, orderPrams1);
    const order2 = new Order(order2Owner, orderPrams2);
    await order1.signAsync();
    await order2.signAsync();

    const ring = new Ring(ringOwner, [order1, order2], minerId, feeSelections);
    await ring.signAsync();

    return ring;
  }

  public async generateSize2Ring02(order1Owner: string,
                                   order2Owner: string,
                                   ringOwner: string,
                                   minerId: BigNumber,
                                   feeSelections: number[]) {

    const orderPrams1 = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.eosAddress,
      tokenB: this.neoAddress,
      amountS: new BigNumber(1000e18),
      amountB: new BigNumber(100e18),
      validSince: new BigNumber(this.currBlockTimeStamp),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 150),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 100,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const orderPrams2 = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.neoAddress,
      tokenB: this.eosAddress,
      amountS: new BigNumber(50e18),
      amountB: new BigNumber(450e18),
      validSince: new BigNumber(this.currBlockTimeStamp),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 160),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 45,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const order1 = new Order(order1Owner, orderPrams1);
    const order2 = new Order(order2Owner, orderPrams2);
    await order1.signAsync();
    await order2.signAsync();

    const ring = new Ring(ringOwner, [order1, order2], minerId, feeSelections);
    await ring.signAsync();

    return ring;
  }

  public async generateSize2Ring03(order1Owner: string,
                                   order2Owner: string,
                                   ringOwner: string,
                                   minerId: BigNumber,
                                   feeSelections: number[]) {
    const orderPrams1: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.eosAddress,
      tokenB: this.neoAddress,
      amountS: new BigNumber(1000e18),
      amountB: new BigNumber(100e18),
      validSince: new BigNumber(this.currBlockTimeStamp),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 210),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: true,
      marginSplitPercentage: 65,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const orderPrams2: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.neoAddress,
      tokenB: this.eosAddress,
      amountS: new BigNumber(50e18),
      amountB: new BigNumber(450e18),
      validSince: new BigNumber(this.currBlockTimeStamp),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 211),
      lrcFee: new BigNumber(5e17),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 45,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const order1 = new Order(order1Owner, orderPrams1);
    const order2 = new Order(order2Owner, orderPrams2);
    await order1.signAsync();
    await order2.signAsync();

    const ring = new Ring(ringOwner, [order1, order2], minerId, feeSelections);
    await ring.signAsync();

    return ring;
  }

  public async generateSize3Ring01(order1Owner: string,
                                   order2Owner: string,
                                   order3Owner: string,
                                   ringOwner: string,
                                   minerId: BigNumber,
                                   feeSelections: number[]) {
    const orderPrams1: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.eosAddress,
      tokenB: this.neoAddress,
      amountS: new BigNumber(80000e18),
      amountB: new BigNumber(12345e18),
      validSince: new BigNumber(this.currBlockTimeStamp),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 310),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: true,
      marginSplitPercentage: 55,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const orderPrams2: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.neoAddress,
      tokenB: this.qtumAddress,
      amountS: new BigNumber(234e18),
      amountB: new BigNumber(543e18),
      validSince: new BigNumber(this.currBlockTimeStamp),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 311),
      lrcFee: new BigNumber(6e18),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 0,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const orderPrams3: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.qtumAddress,
      tokenB: this.eosAddress,
      amountS: new BigNumber(6780e18),
      amountB: new BigNumber(18100e18),
      validSince: new BigNumber(this.currBlockTimeStamp),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 312),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 60,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const order1 = new Order(order1Owner, orderPrams1);
    const order2 = new Order(order2Owner, orderPrams2);
    const order3 = new Order(order3Owner, orderPrams3);
    await order1.signAsync();
    await order2.signAsync();
    await order3.signAsync();

    const ring = new Ring(ringOwner, [order1, order2, order3], minerId, feeSelections);
    await ring.signAsync();

    return ring;
  }

  public async generateSize3Ring02(order1Owner: string,
                                   order2Owner: string,
                                   order3Owner: string,
                                   ringOwner: string,
                                   salt: number,
                                   minerId: BigNumber,
                                   feeSelections: number[]) {
    const orderPrams1: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.eosAddress,
      tokenB: this.neoAddress,
      amountS: new BigNumber(80000e18),
      amountB: new BigNumber(12345e18),
      validSince: new BigNumber(this.currBlockTimeStamp - salt),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 320),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: true,
      marginSplitPercentage: 55,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const orderPrams2: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.neoAddress,
      tokenB: this.qtumAddress,
      amountS: new BigNumber(234e18),
      amountB: new BigNumber(543e18),
      validSince: new BigNumber(this.currBlockTimeStamp - salt),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 321),
      lrcFee: new BigNumber(6e18),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 0,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const orderPrams3: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.qtumAddress,
      tokenB: this.eosAddress,
      amountS: new BigNumber(6780e18),
      amountB: new BigNumber(18100e18),
      validSince: new BigNumber(this.currBlockTimeStamp - salt),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 322),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 60,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const order1 = new Order(order1Owner, orderPrams1);
    const order2 = new Order(order2Owner, orderPrams2);
    const order3 = new Order(order3Owner, orderPrams3);
    await order1.signAsync();
    await order2.signAsync();
    await order3.signAsync();

    const ring = new Ring(ringOwner, [order1, order2, order3], minerId, feeSelections);
    await ring.signAsync();

    return ring;
  }

  public async generateSize3Ring03(order1Owner: string,
                                   order2Owner: string,
                                   order3Owner: string,
                                   ringOwner: string,
                                   salt: number,
                                   minerId: BigNumber,
                                   feeSelections: number[]) {
    const orderPrams1: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.eosAddress,
      tokenB: this.lrcAddress,
      amountS: new BigNumber(1000e18),
      amountB: new BigNumber(8000e18),
      validSince: new BigNumber(this.currBlockTimeStamp - salt),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 330),
      lrcFee: new BigNumber(10e18),
      buyNoMoreThanAmountB: true,
      marginSplitPercentage: 55,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const orderPrams2: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.lrcAddress,
      tokenB: this.neoAddress,
      amountS: new BigNumber(2000e18),
      amountB: new BigNumber(10e18),
      validSince: new BigNumber(this.currBlockTimeStamp - salt),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 331),
      lrcFee: new BigNumber(6e18),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 0,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const orderPrams3: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.neoAddress,
      tokenB: this.eosAddress,
      amountS: new BigNumber(20e18),
      amountB: new BigNumber(450e18),
      validSince: new BigNumber(this.currBlockTimeStamp - salt),
      validUntil: new BigNumber((this.currBlockTimeStamp + 360000) + 332),
      lrcFee: new BigNumber(1e18),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 60,
      authAddr: this.authAddress,
      walletId: new BigNumber(0),
    };

    const order1 = new Order(order1Owner, orderPrams1);
    const order2 = new Order(order2Owner, orderPrams2);
    const order3 = new Order(order3Owner, orderPrams3);
    await order1.signAsync();
    await order2.signAsync();
    await order3.signAsync();

    const ring = new Ring(ringOwner, [order1, order2, order3], minerId, feeSelections);
    await ring.signAsync();

    return ring;
  }

  public caculateRateAmountS(ring: Ring) {
    let rate: number = 1;
    const result: BigNumber[] = [];
    const size = ring.orders.length;
    for (let i = 0; i < size; i++) {
      const order = ring.orders[i];
      rate = rate * order.params.amountS.toNumber() / order.params.amountB.toNumber();
    }

    rate = Math.pow(rate, -1 / size);

    for (let i = 0; i < size; i ++) {
      const order = ring.orders[i];
      const rateAmountS = order.params.amountS.toNumber() * rate;
      const rateSBigNumber = new BigNumber(rateAmountS.toPrecision(15));
      result.push(rateSBigNumber);
    }

    return result;
  }

  public ringToSubmitableParams(ring: Ring,
                                feeSelectionList: number[],
                                feeRecepient: string) {
    const ringSize = ring.orders.length;
    const addressList: string[][] = [];
    const uintArgsList: BigNumber[][] = [];
    const uint8ArgsList: number[][] = [];
    const buyNoMoreThanAmountBList: boolean[] = [];
    const vList: number[] = [];
    const rList: string[] = [];
    const sList: string[] = [];

    const rateAmountSList = this.caculateRateAmountS(ring);
    // console.log("rateAmountSList", rateAmountSList);

    for (let i = 0; i < ringSize; i++) {
      const order = ring.orders[i];
      const addressListItem = [order.owner, order.params.tokenS, order.params.authAddr];
      addressList.push(addressListItem);

      const uintArgsListItem = [
        order.params.amountS,
        order.params.amountB,
        order.params.validSince,
        order.params.validUntil,
        order.params.lrcFee,
        rateAmountSList[i],
        order.params.walletId,
      ];
      uintArgsList.push(uintArgsListItem);

      const uint8ArgsListItem = [order.params.marginSplitPercentage, feeSelectionList[i]];
      // console.log("uint8ArgsListItem", uint8ArgsListItem);

      uint8ArgsList.push(uint8ArgsListItem);

      buyNoMoreThanAmountBList.push(order.params.buyNoMoreThanAmountB);

      vList.push(order.params.v);
      rList.push(order.params.r);
      sList.push(order.params.s);
    }

    vList.push(...ring.authV);
    rList.push(...ring.authR);
    sList.push(...ring.authS);

    vList.push(ring.v);
    rList.push(ring.r);
    sList.push(ring.s);

    const submitParams = {
      addressList,
      uintArgsList,
      uint8ArgsList,
      buyNoMoreThanAmountBList,
      vList,
      rList,
      sList,
      ringOwner: ring.owner,
      feeRecepient,
    };

    return submitParams;
  }

}
