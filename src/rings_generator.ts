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

      if (order.onChain) {
        continue;
      }

      if (order.sig === undefined) {
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
      rings.miner ? ((rings.miner === feeRecipient) ? "0x0" : rings.miner) : "0x0",
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
      if (rings.sig === undefined) {
        rings.sig = await this.multiHashUtil.signAsync(rings.signAlgorithm, rings.hash, miner);
      }
    }

    // Dual Authoring
    for (const order of rings.orders) {
      if (order.onChain) {
        continue;
      }

      if (order.dualAuthSig === undefined) {
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
    encodeSpecs.push(param.orderSpecs.length);
    encodeSpecs.push(param.ringSpecs.length);
    encodeSpecs.push(numSpendables);
    encodeSpecs.push(param.data.length());

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
      data: new Bitstream(),
    };

    this.calculateMiningSepc(ringsInfo, param);
    param.ringSpecs = ringsInfo.rings;
    ringsInfo.orders.map((o) => this.calculateOrderSpec(o, param));

    // console.log("transactionOrigin: " + ringsInfo.transactionOrigin);
    // console.log("feeRecipient: " + ringsInfo.feeRecipient);
    // console.log("miner: " + ringsInfo.miner);
    ringsInfo.orders.forEach((o) => console.log(o));
    return param;
  }

  private calculateMiningSepc(ringsInfo: RingsInfo, param: RingsSubmitParam) {

    const feeRecipient = ringsInfo.feeRecipient ? ringsInfo.feeRecipient : ringsInfo.transactionOrigin;
    const miner = ringsInfo.miner ? ringsInfo.miner : feeRecipient;

    let miningSpec = 0;
    if (feeRecipient !== ringsInfo.transactionOrigin) {
      miningSpec += 1;
      param.data.addAddress(ringsInfo.feeRecipient);
    }

    if (miner !== feeRecipient) {
      miningSpec += 1 << 1;
      param.data.addAddress(ringsInfo.miner);
    }

    if (ringsInfo.sig && miner !== ringsInfo.transactionOrigin) {
      miningSpec += 1 << 2;
      param.data.addNumber((ringsInfo.sig.length - 2) / 2, 32);
      param.data.addRawBytes(ringsInfo.sig);
    }

    param.miningSpec = miningSpec;
  }

  private calculateOrderSpec(order: OrderInfo, param: RingsSubmitParam) {
    param.data.addAddress(order.owner);
    param.data.addAddress(order.tokenS);
    param.data.addNumber(order.amountS, 32);
    param.data.addNumber(order.amountB, 32);
    param.data.addNumber(order.validSince, 32);
    param.data.addNumber(order.tokenSpendableS.index, 2);
    param.data.addNumber(order.tokenSpendableFee.index, 2);

    let spec = 0;
    if (order.dualAuthAddr) {
      spec += 1;
      param.data.addAddress(order.dualAuthAddr);
    }

    if (order.broker) {
      spec += 1 << 1;
      param.data.addAddress(order.broker);
      param.data.addNumber(order.brokerSpendableS.index, 2);
      param.data.addNumber(order.brokerSpendableFee.index, 2);
    }
    if (order.orderInterceptor) {
      spec += 1 << 2;
      param.data.addAddress(order.orderInterceptor);
    }
    if (order.walletAddr) {
      spec += 1 << 3;
      param.data.addAddress(order.walletAddr);
    }

    if (order.validUntil) {
      spec += 1 << 4;
      param.data.addNumber(order.validUntil, 32);
    }
    if (order.allOrNone) {
      spec += 1 << 5;
    }

    if (order.sig) {
      spec += 1 << 6;
      param.data.addNumber((order.sig.length - 2) / 2, 32);
      param.data.addRawBytes(order.sig);
    }

    if (order.dualAuthSig) {
      spec += 1 << 7;
      param.data.addNumber((order.dualAuthSig.length - 2) / 2, 32);
      param.data.addRawBytes(order.dualAuthSig);
    }

    if (order.feeToken && order.feeToken !== this.context.lrcAddress) {
      spec += 1 << 8;
      param.data.addAddress(order.feeToken);
    }

    if (order.feeAmount) {
      spec += 1 << 9;
      param.data.addNumber(order.feeAmount, 32);
    }

    if (order.feePercentage) {
      spec += 1 << 10;
      param.data.addNumber(order.feePercentage, 2);
    }

    if (order.waiveFeePercentage) {
      spec += 1 << 11;
      param.data.addNumber(order.waiveFeePercentage, 2);
    }

    if (order.tokenSFeePercentage) {
      spec += 1 << 12;
      param.data.addNumber(order.tokenSFeePercentage, 2);
    }

    if (order.tokenBFeePercentage) {
      spec += 1 << 13;
      param.data.addNumber(order.tokenBFeePercentage, 2);
    }

    if (order.tokenRecipient && order.tokenRecipient !== order.owner) {
      spec += 1 << 14;
      param.data.addAddress(order.tokenRecipient);
    }

    if (order.walletSplitPercentage) {
      spec += 1 << 15;
      param.data.addNumber(order.walletSplitPercentage, 2);
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
    stream.addHex(param.data.getData());
    param.ringSpecs.forEach((ring) => {
      stream.addNumber(ring.length, 1);
      ring.forEach((o) => stream.addNumber(o, 1));
    });

    return stream.getData();
  }

  private xor(s1: string, s2: string, numBytes: number) {
    const x1 = new BN(s1.slice(2), 16);
    const x2 = new BN(s2.slice(2), 16);
    const result = x1.xor(x2);
    return "0x" + result.toString(16, numBytes * 2);
  }
}
