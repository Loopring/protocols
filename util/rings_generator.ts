import { BigNumber } from "bignumber.js";
import { Bitstream } from "./bitstream";
import { Order } from "./order";
import { Ring } from "./ring";
import { OrderInfo, RingsInfo, RingsSubmitParam } from "./types";

export class RingsGenerator {
  public delegateContractAddr: string;
  public currBlockTimeStamp: number;

  constructor(delegateContractAddr: string,
              currBlockTimeStamp: number) {
    this.delegateContractAddr = delegateContractAddr;
    this.currBlockTimeStamp = currBlockTimeStamp;
  }

  public toSubmitableParam(rings: RingsInfo) {
    const param = this.ringsToParam(rings);

    const encodeSpecs: number[] = [];
    const len = 5 + param.ringSpecs.length + param.bytesList.length;
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

  private ringsToParam(ringsInfo: RingsInfo) {
    const param: RingsSubmitParam = {
      miningSpec: 0,
      orderSpecs: [],
      ringSpecs: [],
      addressList: [],
      uintList: [],
      bytesList: [],
    };

    this.calculateMiningSepc(ringsInfo, param);
    param.ringSpecs = ringsInfo.rings;
    ringsInfo.orders.map((o) => this.calculateOrderSpec(o, param));

    ringsInfo.orders.forEach((o) => console.log(o));
    return param;
  }

  private calculateMiningSepc(ringsInfo: RingsInfo, param: RingsSubmitParam) {
    let miningSpec = 0;
    if (ringsInfo.feeRecipient) {
      miningSpec += 1;
      param.addressList.push(ringsInfo.feeRecipient);
    }

    if (ringsInfo.miner) {
      miningSpec += 1 << 1;
      param.addressList.push(ringsInfo.miner);
    }

    if (ringsInfo.sig) {
      miningSpec += 1 << 2;
      param.bytesList.push(ringsInfo.sig);
    }

    param.miningSpec = miningSpec;
  }

  private calculateOrderSpec(order: OrderInfo, param: RingsSubmitParam) {
    param.addressList.push(order.owner);
    param.addressList.push(order.tokenS);
    // param.addressList.push(order.tokenB);
    param.uintList.push(new BigNumber(order.amountS));
    param.uintList.push(new BigNumber(order.amountB));
    param.uintList.push(new BigNumber(order.lrcFee));

    // param.addressList.push(order.delegateContract);

    let spec = 0;
    if (order.dualAuthAddr) {
      spec += 1;
      param.addressList.push(order.dualAuthAddr);
    }
    if (order.broker) {
      spec += 1 << 1;
      param.addressList.push(order.broker);
    }
    if (order.orderInterceptor) {
      spec += 1 << 2;
      param.addressList.push(order.orderInterceptor);
    }
    if (order.walletAddr) {
      spec += 1 << 3;
      param.addressList.push(order.walletAddr);
    }

    if (order.validSince) {
      spec += 1 << 4;
      param.uintList.push(new BigNumber(order.validSince));
    }
    if (order.validUntil) {
      spec += 1 << 5;
      param.uintList.push(new BigNumber(order.validUntil));
    }
    if (order.buyNoMoreThanAmountB) {
      spec += 1 << 6;
      param.uintList.push(new BigNumber(1));
    }
    if (order.allOrNone) {
      spec += 1 << 7;
      param.uintList.push(new BigNumber(1));
    }

    if (order.sig) {
      spec += 1 << 8;
      param.bytesList.push(order.sig);
    }
    if (order.dualAuthSig) {
      spec += 1 << 9;
      param.bytesList.push(order.dualAuthSig);
    }

    param.orderSpecs.push(spec);
  }

  private submitParamToBytes(param: RingsSubmitParam, encodeSpecs: number[]) {
    // console.log("encodeSpecs:", encodeSpecs);
    // console.log("param.orderSpecs:", param.orderSpecs);
    console.log("addrList:", param.addressList);
    console.log("uintList:", param.uintList);
    // console.log("param.orderSpecs:", param.orderSpecs);
    // console.log("param.ringSpecs:", param.ringSpecs);

    const stream = new Bitstream();
    encodeSpecs.forEach((i) => stream.addNumber(i, 2));
    stream.addNumber(param.miningSpec, 2);
    param.orderSpecs.forEach((i) => stream.addNumber(i, 2));
    const ringSpecsFlattened = [].concat(...param.ringSpecs);
    console.log("ringSpecsFlattened:", ringSpecsFlattened);
    ringSpecsFlattened.forEach((i) => stream.addNumber(i, 1));
    param.addressList.forEach((a) => stream.addAddress(a));
    param.uintList.forEach((bn) => stream.addBigNumber(bn));
    param.bytesList.forEach((bs) => stream.addRawBytes(bs));

    return stream.getData();
  }
}
