import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import promisify = require("es6-promisify");
import ABI = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import Web3 = require("web3");
import { Bitstream } from "./bitstream";
import { MultiHashUtil } from "./multihash";
import { OrderUtil } from "./order";
import { Ring } from "./ring";
import { OrderInfo, RingsInfo, RingsSubmitParam } from "./types";

export class RingsGenerator {
  public delegateContractAddr: string;
  public currBlockTimeStamp: number;

  public web3Instance: Web3;

  private multiHashUtil = new MultiHashUtil();
  private orderUtil = new OrderUtil();

  constructor(delegateContractAddr: string,
              currBlockTimeStamp: number) {
    this.delegateContractAddr = delegateContractAddr;
    this.currBlockTimeStamp = currBlockTimeStamp;
  }

  public async setupRingsAsync(rings: RingsInfo, transactionOrigin: string) {
    // Setup orders
    for (const order of rings.orders) {
      order.hash = this.orderUtil.getOrderHash(order);
      await this.multiHashUtil.signOrderAsync(order);
    }

    // Calculate all ring hashes
    const ringHashes: string[] = [];
    for (const ring of rings.rings) {
      const orderHashes = new Bitstream();
      for (const order of ring) {
        orderHashes.addHex(rings.orders[order].hash.toString("hex"));
      }
      const ringHash = ABI.soliditySHA3(["bytes"], [Buffer.from(orderHashes.getData().slice(2), "hex")]);
      ringHashes.push(ringHash.toString("hex"));
    }

    // XOR ring hashes together for the mining hash
    let ringHashesXOR = ringHashes[0];
    for (let i = 1; i < ringHashes.length; i++) {
      ringHashesXOR = this.xor(ringHashesXOR, ringHashes[i], 32);
    }

    // Calculate mining hash
    const feeRecipient = rings.feeRecipient ? rings.feeRecipient : transactionOrigin;
    const args = [
      feeRecipient,
      rings.miner ? rings.miner : "0x0",
      ringHashesXOR,
    ];
    const argTypes = [
      "address",
      "address",
      "bytes32",
    ];
    rings.hash = ABI.soliditySHA3(argTypes, args);

    // Calculate mining signature
    const miner = rings.miner ? rings.miner : feeRecipient;
    rings.sig = await this.multiHashUtil.signAsync(rings.signAlgorithm, rings.hash, miner);

    // Dual Authoring
    for (const order of rings.orders) {
      if (order.dualAuthAddr) {
        await this.multiHashUtil.signAsync(order.dualAuthSignAlgorithm, rings.hash, order.dualAuthAddr);
      }
    }
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
    // Bytes arrays start with 0x and have 2 characters/byte
    param.bytesList.forEach((bs) => encodeSpecs.push((bs.length - 2) / 2));

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
    if (order.allOrNone) {
      spec += 1 << 6;
      param.uintList.push(new BigNumber(1));
    }

    if (order.sig) {
      spec += 1 << 7;
      param.bytesList.push(order.sig);
    }

    if (order.dualAuthSig) {
      spec += 1 << 8;
      param.bytesList.push(order.dualAuthSig);
    }

    param.orderSpecs.push(spec);
  }

  private submitParamToBytes(param: RingsSubmitParam, encodeSpecs: number[]) {
    // console.log("encodeSpecs:", encodeSpecs);
    // console.log("param.orderSpecs:", param.orderSpecs);
    // console.log("addrList:", param.addressList);
    // console.log("uintList:", param.uintList);
    // console.log("bytesList:", param.bytesList);
    // console.log("param.orderSpecs:", param.orderSpecs);
    // console.log("param.ringSpecs:", param.ringSpecs);

    const stream = new Bitstream();
    encodeSpecs.forEach((i) => stream.addNumber(i, 2));
    stream.addNumber(param.miningSpec, 2);
    param.orderSpecs.forEach((i) => stream.addNumber(i, 2));
    const ringSpecsFlattened = [].concat(...param.ringSpecs);
    // console.log("ringSpecsFlattened:", ringSpecsFlattened);
    ringSpecsFlattened.forEach((i) => stream.addNumber(i, 1));
    param.addressList.forEach((a) => stream.addAddress(a));
    param.uintList.forEach((bn) => stream.addBigNumber(bn));
    param.bytesList.forEach((bs) => stream.addRawBytes(bs));

    return stream.getData();
  }

  private xor(s1: string, s2: string, numBytes: number) {
    const x1 = new BN(s1.slice(0), 16);
    const x2 = new BN(s2.slice(0), 16);
    const result = x1.xor(x2);
    return "0x" + result.toString(16, numBytes * 2);
  }
}
