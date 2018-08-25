import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import promisify = require("es6-promisify");
import ABI = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import Web3 = require("web3");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { MultiHashUtil } from "./multihash";
import { OrderUtil } from "./order";
import { Ring } from "./ring";
import { OrderInfo, RingsInfo, RingsSubmitParam, SignAlgorithm, Spendable } from "./types";

export class RingsGenerator {
  private multiHashUtil = new MultiHashUtil();
  private orderUtil: OrderUtil;
  private context: Context;

  constructor(context: Context) {
    this.context = context;
    this.orderUtil = new OrderUtil(context);
  }

  public async setupRingsAsync(rings: RingsInfo) {
    // Setup orders
    for (const order of rings.orders) {
      order.hash = this.orderUtil.getOrderHash(order);
      if (/*order.sig === undefined*/true) {
        order.sig = await this.multiHashUtil.signOrderAsync(order);
      }
    }

    // Calculate all ring hashes
    const ringHashes: string[] = [];
    for (const ring of rings.rings) {
      const orderHashes = new Bitstream();
      for (const order of ring) {
        orderHashes.addHex(rings.orders[order].hash.toString("hex"));
        orderHashes.addNumber(rings.orders[order].waiveFeePercentage ? rings.orders[order].waiveFeePercentage : 0, 2);
      }
      const ringHash = ABI.soliditySHA3(["bytes"], [Buffer.from(orderHashes.getData().slice(2), "hex")]);
      ringHashes.push("0x" + ringHash.toString("hex"));
    }

    // XOR ring hashes together for the mining hash
    let ringHashesXOR = ringHashes[0];
    for (let i = 1; i < ringHashes.length; i++) {
      ringHashesXOR = this.xor(ringHashesXOR, ringHashes[i], 32);
    }

    // Calculate mining hash
    const feeRecipient = rings.feeRecipient ? rings.feeRecipient : rings.transactionOrigin;
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

    // Calculate mining signature if needed
    const miner = rings.miner ? rings.miner : feeRecipient;
    if (miner === rings.transactionOrigin) {
      rings.sig = undefined;
    } else {
      rings.sig = await this.multiHashUtil.signAsync(rings.signAlgorithm, rings.hash, miner);
    }

    // Dual Authoring
    for (const order of rings.orders) {
      if (/*order.dualAuthSig === undefined*/true) {
        if (order.dualAuthAddr) {
          order.dualAuthSig = await this.multiHashUtil.signAsync(
            order.dualAuthSignAlgorithm,
            rings.hash,
            order.dualAuthAddr,
          );
        }
      }
    }
  }

  public toSubmitableParam(rings: RingsInfo) {
    const numSpendables = this.setupSpendables(rings);
    const param = this.ringsToParam(rings);

    const encodeSpecs: number[] = [];
    const len = 7 + param.ringSpecs.length + param.bytesList.length;
    encodeSpecs.push(len);
    encodeSpecs.push(param.orderSpecs.length);
    encodeSpecs.push(param.ringSpecs.length);
    encodeSpecs.push(param.addressList.length);
    encodeSpecs.push(param.uintList.length);
    encodeSpecs.push(param.uint16List.length);
    encodeSpecs.push(param.bytesList.length);
    encodeSpecs.push(numSpendables);
    param.ringSpecs.forEach((rs) => encodeSpecs.push(rs.length));
    // Bytes arrays start with 0x and have 2 characters/byte
    param.bytesList.forEach((bs) => encodeSpecs.push((bs.length - 2) / 2));

    return this.submitParamToBytes(param, encodeSpecs);
  }

  private setupSpendables(rings: RingsInfo) {
    let numSpendables = 0;
    const ownerTokens: { [id: string]: any; } = {};
    const ownerBrokerTokens: { [id: string]: any; } = {};
    for (const order of rings.orders) {
      const tokenFee = order.feeToken ? order.feeToken : this.context.lrcAddress;
      // Token spendables
      if (!ownerTokens[order.owner]) {
        ownerTokens[order.owner] = {};
      }
      if (!ownerTokens[order.owner][order.tokenS]) {
        ownerTokens[order.owner][order.tokenS] = {
          index: numSpendables++,
        };
      }
      order.tokenSpendableS = ownerTokens[order.owner][order.tokenS];
      if (!ownerTokens[order.owner][tokenFee]) {
        ownerTokens[order.owner][tokenFee] = {
          index: numSpendables++,
        };
      }
      order.tokenSpendableFee = ownerTokens[order.owner][tokenFee];
      // Broker allowances
      if (order.broker) {
        if (!ownerBrokerTokens[order.owner]) {
          ownerBrokerTokens[order.owner] = {};
        }
        if (!ownerBrokerTokens[order.owner][order.broker]) {
          ownerBrokerTokens[order.owner][order.broker] = {};
        }
        if (!ownerBrokerTokens[order.owner][order.broker][order.tokenS]) {
          ownerBrokerTokens[order.owner][order.broker][order.tokenS] = {
            index: numSpendables++,
          };
        }
        order.brokerSpendableS = ownerBrokerTokens[order.owner][order.broker][order.tokenS];
        if (!ownerBrokerTokens[order.owner][order.broker][tokenFee]) {
          ownerBrokerTokens[order.owner][order.broker][tokenFee] = {
            index: numSpendables++,
          };
        }
        order.brokerSpendableFee = ownerBrokerTokens[order.owner][order.broker][tokenFee];
      }
    }
    return numSpendables;
  }

  private ringsToParam(ringsInfo: RingsInfo) {
    const param: RingsSubmitParam = {
      miningSpec: 0,
      orderSpecs: [],
      ringSpecs: [],
      addressList: [],
      uintList: [],
      uint16List: [],
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
    param.uintList.push(new BigNumber(order.validSince));
    param.uint16List.push(order.tokenSpendableS.index);
    param.uint16List.push(order.tokenSpendableFee.index);

    // param.addressList.push(order.delegateContract);

    let spec = 0;
    if (order.dualAuthAddr) {
      spec += 1;
      param.addressList.push(order.dualAuthAddr);
    }

    if (order.broker) {
      spec += 1 << 1;
      param.addressList.push(order.broker);
      param.uint16List.push(order.brokerSpendableS.index);
      param.uint16List.push(order.brokerSpendableFee.index);
    }
    if (order.orderInterceptor) {
      spec += 1 << 2;
      param.addressList.push(order.orderInterceptor);
    }
    if (order.walletAddr) {
      spec += 1 << 3;
      param.addressList.push(order.walletAddr);
    }

    if (order.validUntil) {
      spec += 1 << 4;
      param.uintList.push(new BigNumber(order.validUntil));
    }
    if (order.allOrNone) {
      spec += 1 << 5;
      param.uintList.push(new BigNumber(1));
    }

    if (order.sig) {
      spec += 1 << 6;
      param.bytesList.push(order.sig);
    }

    if (order.dualAuthSig) {
      spec += 1 << 7;
      param.bytesList.push(order.dualAuthSig);
    }

    if (order.feeToken) {
      spec += 1 << 8;
      param.addressList.push(order.feeToken);
    }

    if (order.feeAmount) {
      spec += 1 << 9;
      param.uintList.push(new BigNumber(order.feeAmount));
    }

    if (order.feePercentage) {
      spec += 1 << 10;
      param.uint16List.push(order.feePercentage);
    }

    if (order.waiveFeePercentage) {
      spec += 1 << 11;
      param.uint16List.push(order.waiveFeePercentage);
    }

    if (order.tokenSFeePercentage) {
      spec += 1 << 12;
      param.uint16List.push(order.tokenSFeePercentage);
    }

    if (order.tokenBFeePercentage) {
      spec += 1 << 13;
      param.uint16List.push(order.tokenBFeePercentage);
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
    param.uint16List.forEach((n) => stream.addNumber(n, 2));
    param.bytesList.forEach((bs) => stream.addRawBytes(bs));

    return stream.getData();
  }

  private xor(s1: string, s2: string, numBytes: number) {
    const x1 = new BN(s1.slice(2), 16);
    const x2 = new BN(s2.slice(2), 16);
    const result = x1.xor(x2);
    return "0x" + result.toString(16, numBytes * 2);
  }
}
