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

  constructor(loopringProtocolAddr: string,
              eosAddress: string,
              neoAddress: string,
              lrcAddress: string,
              qtumAddress: string,
              currBlockTimeStamp: number) {
    this.loopringProtocolAddr = loopringProtocolAddr;
    this.eosAddress = eosAddress;
    this.neoAddress = neoAddress;
    this.lrcAddress = lrcAddress;
    this.qtumAddress = qtumAddress;
    this.currBlockTimeStamp = currBlockTimeStamp;
  }

  public async generateSize2Ring01(order1Owner: string,
                                   order2Owner: string,
                                   ringOwner: string) {
    const orderPrams1 = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.eosAddress,
      tokenB: this.neoAddress,
      amountS: new BigNumber(1000e18),
      amountB: new BigNumber(100e18),
      timestamp: new BigNumber(this.currBlockTimeStamp),
      ttl: new BigNumber(360000),
      salt: new BigNumber(1234),
      lrcFee: new BigNumber(10e18),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 0,
    };

    const orderPrams2 = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.neoAddress,
      tokenB: this.eosAddress,
      amountS: new BigNumber(100e18),
      amountB: new BigNumber(1000e18),
      timestamp: new BigNumber(this.currBlockTimeStamp),
      ttl: new BigNumber(360000),
      salt: new BigNumber(4321),
      lrcFee: new BigNumber(5e18),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 0,
    };

    const order1 = new Order(order1Owner, orderPrams1);
    const order2 = new Order(order2Owner, orderPrams2);
    await order1.signAsync();
    await order2.signAsync();

    const ring = new Ring(ringOwner, [order1, order2]);
    await ring.signAsync();

    return ring;
  }

  public async generateSize2Ring02(order1Owner: string,
                                   order2Owner: string,
                                   ringOwner: string) {
    const orderPrams1 = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.eosAddress,
      tokenB: this.neoAddress,
      amountS: new BigNumber(1000e18),
      amountB: new BigNumber(100e18),
      timestamp: new BigNumber(this.currBlockTimeStamp),
      ttl: new BigNumber(360000),
      salt: new BigNumber(1234),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 100,
    };

    const orderPrams2 = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.neoAddress,
      tokenB: this.eosAddress,
      amountS: new BigNumber(50e18),
      amountB: new BigNumber(450e18),
      timestamp: new BigNumber(this.currBlockTimeStamp),
      ttl: new BigNumber(360000),
      salt: new BigNumber(4321),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 45,
    };

    const order1 = new Order(order1Owner, orderPrams1);
    const order2 = new Order(order2Owner, orderPrams2);
    await order1.signAsync();
    await order2.signAsync();

    const ring = new Ring(ringOwner, [order1, order2]);
    await ring.signAsync();

    return ring;
  }

  public async generateSize2Ring03(order1Owner: string,
                                   order2Owner: string,
                                   ringOwner: string) {
    const orderPrams1: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.eosAddress,
      tokenB: this.neoAddress,
      amountS: new BigNumber(1000e18),
      amountB: new BigNumber(100e18),
      timestamp: new BigNumber(this.currBlockTimeStamp),
      ttl: new BigNumber(360000),
      salt: new BigNumber(1234),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: true,
      marginSplitPercentage: 65,
    };

    const orderPrams2: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.neoAddress,
      tokenB: this.eosAddress,
      amountS: new BigNumber(50e18),
      amountB: new BigNumber(450e18),
      timestamp: new BigNumber(this.currBlockTimeStamp),
      ttl: new BigNumber(360000),
      salt: new BigNumber(4321),
      lrcFee: new BigNumber(5e17),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 45,
    };

    const order1 = new Order(order1Owner, orderPrams1);
    const order2 = new Order(order2Owner, orderPrams2);
    await order1.signAsync();
    await order2.signAsync();

    const ring = new Ring(ringOwner, [order1, order2]);
    await ring.signAsync();

    return ring;
  }

  public async generateSize3Ring01(order1Owner: string,
                                   order2Owner: string,
                                   order3Owner: string,
                                   ringOwner: string) {
    const orderPrams1: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.eosAddress,
      tokenB: this.neoAddress,
      amountS: new BigNumber(80000e18),
      amountB: new BigNumber(12345e18),
      timestamp: new BigNumber(this.currBlockTimeStamp),
      ttl: new BigNumber(360000),
      salt: new BigNumber(1234),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: true,
      marginSplitPercentage: 55,
    };

    const orderPrams2: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.neoAddress,
      tokenB: this.qtumAddress,
      amountS: new BigNumber(234e18),
      amountB: new BigNumber(543e18),
      timestamp: new BigNumber(this.currBlockTimeStamp),
      ttl: new BigNumber(360000),
      salt: new BigNumber(4321),
      lrcFee: new BigNumber(6e18),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 0,
    };

    const orderPrams3: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.qtumAddress,
      tokenB: this.eosAddress,
      amountS: new BigNumber(6780e18),
      amountB: new BigNumber(18100e18),
      timestamp: new BigNumber(this.currBlockTimeStamp),
      ttl: new BigNumber(360000),
      salt: new BigNumber(4321),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 60,
    };

    const order1 = new Order(order1Owner, orderPrams1);
    const order2 = new Order(order2Owner, orderPrams2);
    const order3 = new Order(order3Owner, orderPrams3);
    await order1.signAsync();
    await order2.signAsync();
    await order3.signAsync();

    const ring = new Ring(ringOwner, [order1, order2, order3]);
    await ring.signAsync();

    return ring;
  }

  public async generateSize3Ring02(order1Owner: string,
                                   order2Owner: string,
                                   order3Owner: string,
                                   ringOwner: string,
                                   salt: number) {
    const orderPrams1: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.eosAddress,
      tokenB: this.neoAddress,
      amountS: new BigNumber(80000e18),
      amountB: new BigNumber(12345e18),
      timestamp: new BigNumber(this.currBlockTimeStamp),
      ttl: new BigNumber(36000),
      salt: new BigNumber(salt + 1),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: true,
      marginSplitPercentage: 55,
    };

    const orderPrams2: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.neoAddress,
      tokenB: this.qtumAddress,
      amountS: new BigNumber(234e18),
      amountB: new BigNumber(543e18),
      timestamp: new BigNumber(this.currBlockTimeStamp),
      ttl: new BigNumber(360000),
      salt: new BigNumber(salt + 2),
      lrcFee: new BigNumber(6e18),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 0,
    };

    const orderPrams3: OrderParams = {
      loopringProtocol: this.loopringProtocolAddr,
      tokenS: this.qtumAddress,
      tokenB: this.eosAddress,
      amountS: new BigNumber(6780e18),
      amountB: new BigNumber(18100e18),
      timestamp: new BigNumber(this.currBlockTimeStamp),
      ttl: new BigNumber(360000),
      salt: new BigNumber(salt + 3),
      lrcFee: new BigNumber(0),
      buyNoMoreThanAmountB: false,
      marginSplitPercentage: 60,
    };

    const order1 = new Order(order1Owner, orderPrams1);
    const order2 = new Order(order2Owner, orderPrams2);
    const order3 = new Order(order3Owner, orderPrams3);
    await order1.signAsync();
    await order2.signAsync();
    await order3.signAsync();

    const ring = new Ring(ringOwner, [order1, order2, order3]);
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
      const addressListItem = [order.owner, order.params.tokenS];
      addressList.push(addressListItem);

      const uintArgsListItem = [
        order.params.amountS,
        order.params.amountB,
        order.params.timestamp,
        order.params.ttl,
        order.params.salt,
        order.params.lrcFee,
        rateAmountSList[i],
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
