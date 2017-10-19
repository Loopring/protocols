import { BigNumber } from 'bignumber.js';
import { OrderParams, LoopringSubmitParams } from '../util/types';
import { Order } from './order';
import { Ring } from './ring';
import { BNUtil } from './bn_util';

//bigNumberConfigs.configure();

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
      buyNoMoreThanAmountB: true,
      marginSplitPercentage: 65,
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
    const orderPrams1 = {
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

    const orderPrams2 = {
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

    const orderPrams3 = {
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

  public caculateRateAmountS(ring: Ring) {
    let rate: number = 1;
    let result: BigNumber[] = [];
    const size = ring.orders.length;
    for (let i = 0; i < size; i++) {
      const order = ring.orders[i];
      rate = rate * order.params.amountS.toNumber() / order.params.amountB.toNumber();
    }

    rate = Math.pow(rate, -1/size)
    //rate = rate.toPrecision(12);
    //console.log("rate:", rate);

    for (let i = 0; i < size; i ++) {
      const order = ring.orders[i];
      const rateAmountS = order.params.amountS.toNumber() * rate;
      const rateSBigNumber = new BigNumber(rateAmountS.toPrecision(12));
      result.push(rateSBigNumber);
    }

    return result;
  }

  public ringToSubmitableParams(ring: Ring,
                                feeSelectionList: number[],
                                feeRecepient: string,
                                throwIfLRCIsInsuffcient: boolean) {
    const ringSize = ring.orders.length;
    let addressList: string[][] = [];
    let uintArgsList: BigNumber[][] = [];
    let uint8ArgsList: number[][] = [];
    let buyNoMoreThanAmountBList: boolean[] = [];
    let vList: number[] = [];
    let rList: string[] = [];
    let sList: string[] = [];

    const rateAmountSList = this.caculateRateAmountS(ring);
    //console.log("rateAmountSList", rateAmountSList);

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
        rateAmountSList[i]
      ];
      uintArgsList.push(uintArgsListItem);

      const uint8ArgsListItem = [order.params.marginSplitPercentage, feeSelectionList[i]];
      //console.log("uint8ArgsListItem", uint8ArgsListItem);

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
      addressList: addressList,
      uintArgsList: uintArgsList,
      uint8ArgsList: uint8ArgsList,
      buyNoMoreThanAmountBList: buyNoMoreThanAmountBList,
      vList: vList,
      rList: rList,
      sList: sList,
      ringOwner: ring.owner,
      feeRecepient: feeRecepient,
      throwIfLRCIsInsuffcient: throwIfLRCIsInsuffcient
    }

    return submitParams;
  }

  public caculateRingFeesAndBalances(ring: Ring, feeSelectionList: number[]) {
    const rateAmountSList = this.caculateRateAmountS(ring);
    let fillAmountSList: number[] = [];
    const size = ring.orders.length;

    // caculate fillAmountS, scale by smallest index.
    let smallestIndex = -1;
    for (let i = 0; i < size; i++) {
      const order = ring.orders[i];

      if (i == 0) {
        fillAmountSList.push(rateAmountSList[0].toNumber());
      } else {
        const fillAmountSMax: number = fillAmountSList[i - 1] * order.params.amountB.toNumber() / rateAmountSList[i - 1].toNumber();

        if (fillAmountSMax > order.params.amountS.toNumber()) {
          smallestIndex = i;
          fillAmountSList.push(order.params.amountS.toNumber());
        } else {
          if (fillAmountSMax > rateAmountSList[i].toNumber()) {
            if (order.params.buyNoMoreThanAmountB) {
              fillAmountSList.push(rateAmountSList[i].toNumber());
            } else {
              fillAmountSList.push(fillAmountSMax);
            }
          } else {
            fillAmountSList.push(fillAmountSMax);
          }
          smallestIndex = i - 1;
        }
      }
    }

    for (let i = 0; i < size; i++) {
      const ind = (smallestIndex + i) % size;
      const nextInd = (ind + 1) % size;
      const order = ring.orders[ind];
      const nextFillAmountSNumber = fillAmountSList[ind] * order.params.amountB.toNumber() / rateAmountSList[ind].toNumber();
      fillAmountSList[nextInd] = nextFillAmountSNumber;
    }

    let result: any = {};
    let fees: any = [];
    let balances: any = [];

    // caculate fees for each order. and assemble result.
    for (let i = 0; i < size; i++) {
      const nextInd = (i+1) % size;
      const order = ring.orders[i];

      let feeItem: any = {};
      feeItem.fillS = fillAmountSList[i];
      if (0 == feeSelectionList[i]) {
        feeItem.feeLrc = order.params.lrcFee.toNumber();
        feeItem.feeS = 0;
        feeItem.feeB = 0;
      } else if (1 == feeSelectionList[i]) {
        if (order.params.buyNoMoreThanAmountB) {
          feeItem.feeS = fillAmountSList[i] * order.params.amountS.toNumber() / rateAmountSList[i].toNumber()  - fillAmountSList[i];
          feeItem.feeS = feeItem.feeS * order.params.marginSplitPercentage / 100;
          feeItem.feeB = 0;
        } else {
          feeItem.feeS = 0;
          feeItem.feeB = fillAmountSList[nextInd] - fillAmountSList[i] * order.params.amountB.toNumber() / order.params.amountS.toNumber();
          feeItem.feeB = feeItem.feeB * order.params.marginSplitPercentage / 100;
        }
      } else {
        throw new Error("invalid fee selection value.");
      }

      fees.push(feeItem);
    }

    result.fees = fees;

    for (let i = 0; i < size; i++) {
      const order = ring.orders[i];
      const prevInd = this.getPrevIndex(i, size);

      let balanceItem: any = {};
      balanceItem.balanceS = order.params.amountS.toNumber() - fillAmountSList[i] - fees[i].feeS;
      balanceItem.balanceB = fillAmountSList[prevInd] - fees[i].feeB;
      balanceItem.feeSTotal = fees[i].feeS + fees[prevInd].feeB;
      balances.push(balanceItem);
    }

    result.balances = balances;
    //console.log("result:", result);
    return result;
  }

  private getPrevIndex(i: number, size: number) {
    if (i <= 0) return size - 1;
    else return (i - 1) % size;
  }

};
