import { BigNumber } from "bignumber.js";
import { Bitstream } from "./bitstream";
import { Order } from "./order";
import { Ring } from "./ring";
import { ringsInfoList } from "./ringsConfig";
import { OrderParams, RingInfo, RingsInfo, RingsSubmitParam } from "./types";

export interface Rings {
  description?: string;
  rings: Ring[];
}

export class RingsGenerator {
  public delegateContractAddr: string;
  public currBlockTimeStamp: number;

  constructor(delegateContractAddr: string,
              currBlockTimeStamp: number) {
    this.delegateContractAddr = delegateContractAddr;
    this.currBlockTimeStamp = currBlockTimeStamp;
  }

  public getRingsInfoList() {
    return ringsInfoList;
  }

  public async ringsInfoToRings(ringsInfo: RingsInfo) {
    const rings: Ring[] = [];
    for (const ringInfo of ringsInfo.ringInfoList) {
      const ring = await this.generateRing(ringInfo);
      rings.push(ring);
    }

    const ringsObj = {
      description: ringsInfo.description,
      rings,
    };

    return ringsObj;
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
        authAddr: ringInfo.authAddressList[i],
        walletAddr: ringInfo.walletAddrList[i],
      };

      const order = new Order(ringInfo.orderOwners[i], orderParam);
      await order.signAsync();
      orders.push(order);
    }

    const ring = new Ring(ringInfo.miner, orders, ringInfo.feeSelections);
    await ring.signAsync();

    return ring;
  }

  public toSubmitableParam(rings: RingsInfo) {
    // const ringsObj = this.ringsInfoToRings(rings);
    const param: RingsSubmitParam = {
      miningSpec: 8,
      orderSpecs: [0],
      ringSpecs: [[0]],
      addressList: ["0x17233e07c67d086464fD408148c3ABB56245FA64"],
      uintList: [new BigNumber(0)],
      bytesList: ["xxx", "ccc"],
    };

    const encodeSpecs: number[] = [];
    const len = 5 + param.ringSpecs.length + param.bytesList.length;
    console.log("encode specs len:", len);
    encodeSpecs.push(len);
    encodeSpecs.push(param.orderSpecs.length);
    encodeSpecs.push(param.ringSpecs.length);
    encodeSpecs.push(param.addressList.length);
    encodeSpecs.push(param.uintList.length);
    encodeSpecs.push(param.bytesList.length);
    param.ringSpecs.forEach((rs) => encodeSpecs.push(rs.length));
    param.bytesList.forEach((bs) => encodeSpecs.push(bs.length));

    return this.submitParamToBytes(param, encodeSpecs);
  }

  private submitParamToBytes(param: RingsSubmitParam, encodeSpecs: number[]) {
    const stream = new Bitstream();
    encodeSpecs.forEach((i) => stream.addNumber(i, 2));
    stream.addNumber(param.miningSpec, 2);
    param.orderSpecs.forEach((i) => stream.addNumber(i, 2));
    const ringSpecsFlattened = [].concat(...param.ringSpecs);
    ringSpecsFlattened.forEach((i) => stream.addNumber(i, 1));
    param.addressList.forEach((a) => stream.addAddress(a));
    param.uintList.forEach((bn) => stream.addBigNumber(bn));
    param.bytesList.forEach((bs) => stream.addRawBytes(bs));

    return stream.getData();
  }
}
