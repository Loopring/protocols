import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import promisify = require("es6-promisify");
import ABI = require("ethereumjs-abi");
import ethUtil = require("ethereumjs-util");
import Web3 = require("web3");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { logDebug } from "./logs";
import { MultiHashUtil } from "./multihash";
import { OrderUtil } from "./order";
import { Ring } from "./ring";
import { OrderInfo, RingsInfo, RingsSubmitParam, SignAlgorithm, Spendable } from "./types";

export class RingsGenerator {
  private multiHashUtil = new MultiHashUtil();
  private orderUtil: OrderUtil;
  private context: Context;

  private SERIALIZATION_VERSION = 0;
  private ORDER_VERSION = 0;

  private zeroAddress = "0x" + "0".repeat(64);

  constructor(context: Context) {
    this.context = context;
    this.orderUtil = new OrderUtil(context);
  }

  async setupRingsAsync(rings: RingsInfo) {
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
        rings.sig = await this.multiHashUtil.signAsync(rings.signAlgorithm, rings.hash, miner, rings.signerPrivateKey);
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
            order.dualAuthPrivateKey,
          );
        }
      }
    }
  }

  toSubmitableParam(rings: RingsInfo) {
    const numSpendables = this.setupSpendables(rings);
    const param = this.ringsToParam(rings);

    const stream = new Bitstream();
    stream.addNumber(this.SERIALIZATION_VERSION, 2);
    stream.addNumber(rings.orders.length, 2);
    stream.addNumber(param.ringSpecs.length, 2);
    stream.addNumber(numSpendables, 2);
    // Mining + Orders
    stream.addHex(param.tables.getData());
    // Rings
    param.ringSpecs.forEach((ring) => {
      stream.addNumber(ring.length, 1);
      ring.forEach((o) => stream.addNumber(o, 1));
      stream.addNumber(0, 8 - ring.length);
    });
    // Data
    // Add a buffer zone of 32 bytes of zeros before the start of the data blob
    // to allow overwriting the starting bytes.
    stream.addNumber(0, 32);
    stream.addHex(param.data.getData());

    return stream.getData();
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
    }
    return numSpendables;
  }

  private ringsToParam(ringsInfo: RingsInfo) {
    const param: RingsSubmitParam = {
      ringSpecs: [],
      data: new Bitstream(),
      tables: new Bitstream(),
    };

    // Offset 0 is the default so just add dummy bytes at the front so we load zeros
    param.data.addNumber(0, 32);

    this.createMiningTable(ringsInfo, param);
    param.ringSpecs = ringsInfo.rings;
    ringsInfo.orders.map((o) => this.createOrderTable(o, param));

    // logDebug("transactionOrigin: " + ringsInfo.transactionOrigin);
    // logDebug("feeRecipient: " + ringsInfo.feeRecipient);
    // logDebug("miner: " + ringsInfo.miner);
    ringsInfo.orders.forEach((o) => logDebug(o));
    return param;
  }

  private createBytes(data: string) {
    const bitstream = new Bitstream();
    bitstream.addNumber((data.length - 2) / 2, 32);
    bitstream.addRawBytes(data);
    return bitstream.getData();
  }

  private createMiningTable(ringsInfo: RingsInfo, param: RingsSubmitParam) {
    const feeRecipient = ringsInfo.feeRecipient ? ringsInfo.feeRecipient : ringsInfo.transactionOrigin;
    const miner = ringsInfo.miner ? ringsInfo.miner : feeRecipient;

    if (feeRecipient !== ringsInfo.transactionOrigin) {
      this.insertOffset(param, param.data.addAddress(ringsInfo.feeRecipient, 20, false));
    } else {
      this.insertDefault(param);
    }

    if (miner !== feeRecipient) {
      this.insertOffset(param, param.data.addAddress(ringsInfo.miner, 20, false));
    } else {
      this.insertDefault(param);
    }

    if (ringsInfo.sig && miner !== ringsInfo.transactionOrigin) {
      this.insertOffset(param, param.data.addHex(this.createBytes(ringsInfo.sig), false));
      this.addPadding(param);
    } else {
      this.insertDefault(param);
    }
  }

  private insertOffset(param: RingsSubmitParam, offset: number) {
    assert(offset % 4 === 0);
    param.tables.addNumber(offset / 4, 2);
  }

  private insertDefault(param: RingsSubmitParam) {
    param.tables.addNumber(0, 2);
  }

  private addPadding(param: RingsSubmitParam) {
    if (param.data.length() % 4 !== 0) {
      param.data.addNumber(0, 4 - (param.data.length() % 4));
    }
  }

  private createOrderTable(order: OrderInfo, param: RingsSubmitParam) {
    this.addPadding(param);
    this.insertOffset(param, this.ORDER_VERSION);
    this.insertOffset(param, param.data.addAddress(order.owner, 20, false));
    this.insertOffset(param, param.data.addAddress(order.tokenS, 20, false));
    this.insertOffset(param, param.data.addAddress(order.tokenB, 20, false));
    this.insertOffset(param, param.data.addNumber(order.amountS, 32, false));
    this.insertOffset(param, param.data.addNumber(order.amountB, 32, false));
    this.insertOffset(param, param.data.addNumber(order.validSince, 4, false));
    if (order.tokenSpendableS.index) {
      param.tables.addNumber(order.tokenSpendableS.index, 2);
    }  else {
      param.tables.addNumber(0, 2);
    }
    if (order.tokenSpendableFee.index) {
      param.tables.addNumber(order.tokenSpendableFee.index, 2);
    } else {
      param.tables.addNumber(0, 2);
    }

    if (order.dualAuthAddr) {
      this.insertOffset(param, param.data.addAddress(order.dualAuthAddr, 20, false));
    } else {
      this.insertDefault(param);
    }

    if (order.broker) {
      this.insertOffset(param, param.data.addAddress(order.broker, 20, false));
    } else {
      this.insertDefault(param);
    }

    if (order.orderInterceptor) {
      this.insertOffset(param, param.data.addAddress(order.orderInterceptor, 20, false));
    } else {
      this.insertDefault(param);
    }

    if (order.walletAddr) {
      this.insertOffset(param, param.data.addAddress(order.walletAddr, 20, false));
    } else {
      this.insertDefault(param);
    }

    if (order.validUntil) {
      this.insertOffset(param, param.data.addNumber(order.validUntil, 4, false));
    } else {
      this.insertDefault(param);
    }

    if (order.sig) {
      this.insertOffset(param, param.data.addHex(this.createBytes(order.sig), false));
      this.addPadding(param);
    } else {
      this.insertDefault(param);
    }

    if (order.dualAuthSig) {
      this.insertOffset(param, param.data.addHex(this.createBytes(order.dualAuthSig), false));
      this.addPadding(param);
    } else {
      this.insertDefault(param);
    }

    param.tables.addNumber(order.allOrNone ? 1 : 0, 2);

    if (order.feeToken && order.feeToken !== this.context.lrcAddress) {
      this.insertOffset(param, param.data.addAddress(order.feeToken, 20, false));
    } else {
      this.insertDefault(param);
    }

    if (order.feeAmount) {
      this.insertOffset(param, param.data.addNumber(order.feeAmount, 32, false));
    } else {
      this.insertDefault(param);
    }

    param.tables.addNumber(order.waiveFeePercentage ? order.waiveFeePercentage : 0, 2);
    param.tables.addNumber(order.tokenSFeePercentage ? order.tokenSFeePercentage : 0, 2);
    param.tables.addNumber(order.tokenBFeePercentage ? order.tokenBFeePercentage : 0, 2);

    if (order.tokenRecipient && order.tokenRecipient !== order.owner) {
      this.insertOffset(param, param.data.addAddress(order.tokenRecipient, 20, false));
    } else {
      this.insertDefault(param);
    }

    param.tables.addNumber(order.walletSplitPercentage ? order.walletSplitPercentage : 0, 2);

    param.tables.addNumber(order.tokenTypeS, 2);
    param.tables.addNumber(order.tokenTypeB, 2);
    param.tables.addNumber(order.tokenTypeFee, 2);

    if (order.trancheS && order.trancheS !== "0x0" && order.trancheS !== this.zeroAddress) {
      this.insertOffset(param, param.data.addHex(order.trancheS, false));
    } else {
      this.insertDefault(param);
    }

    if (order.trancheB && order.trancheB !== "0x0" && order.trancheB !== this.zeroAddress) {
      this.insertOffset(param, param.data.addHex(order.trancheB, false));
    } else {
      this.insertDefault(param);
    }

    if (order.transferDataS && order.transferDataS !== "0x" && order.transferDataS !== "") {
      this.insertOffset(param, param.data.addHex(this.createBytes(order.transferDataS), false));
      this.addPadding(param);
    } else {
      this.insertDefault(param);
    }
  }

  private xor(s1: string, s2: string, numBytes: number) {
    const x1 = new BN(s1.slice(2), 16);
    const x2 = new BN(s2.slice(2), 16);
    const result = x1.xor(x2);
    return "0x" + result.toString(16, numBytes * 2);
  }
}
