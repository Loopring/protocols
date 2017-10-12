import { BigNumber } from 'bignumber.js';
import { OrderParams, LoopringSubmitParams } from '../util/types';
import { Order } from './order';
import { Ring } from './ring';

export class RingFactory {
  public loopringProtocolAddr: string;
  public eosAddress: string;
  public neoAddress: string;
  public lrcAddress: string;
  public currBlockTimeStamp: number;

  constructor(loopringProtocolAddr: string,
              eosAddress: string,
              neoAddress: string,
              lrcAddress: string,
              currBlockTimeStamp: number) {
    this.loopringProtocolAddr = loopringProtocolAddr;
    this.eosAddress = eosAddress;
    this.neoAddress = neoAddress;
    this.lrcAddress = lrcAddress;
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
      lrcFee: new BigNumber(10e18),
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
        order.params.amountS
      ];
      uintArgsList.push(uintArgsListItem);

      const uint8ArgsListItem = [order.params.marginSplitPercentage, feeSelectionList[i]];
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

};
