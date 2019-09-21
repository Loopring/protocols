import assert = require("assert");
import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import abi = require("ethereumjs-abi");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { Mining } from "./mining";
import { OrderUtil } from "./order";
import { Ring } from "./ring";
import { OrderInfo, RingMinedEvent, RingsInfo, SimulatorReport, Spendable, TransferItem } from "./types";

export class ExchangeDeserializer {

  private context: Context;

  private data: Bitstream;
  private spendableList?: Spendable[];

  private dataOffset = 0;
  private tableOffset = 0;

  private zeroBytes32 = "0x" + "0".repeat(64);

  constructor(context: Context) {
    this.context = context;
  }

  deserialize(data: string): [Mining, OrderInfo[], number[][]] {

    this.data = new Bitstream(data);

    // Header
    const version = this.data.extractUint16(0);
    const numOrders = this.data.extractUint16(2);
    const numRings = this.data.extractUint16(4);
    const numSpendables = this.data.extractUint16(6);

    // Validation
    assert.equal(version, 0, "Unsupported serialization format");
    assert(numSpendables > 0, "Invalid number of spendables");

    // Calculate data pointers
    const miningDataPtr = 8;
    const orderDataPtr = miningDataPtr + 3 * 2;
    const ringDataPtr = orderDataPtr + (30 * numOrders) * 2;
    const dataBlobPtr = ringDataPtr + (numRings * 9) + 32;

    this.spendableList = [];
    for (let i = 0; i < numSpendables; i++) {
      const spendable = {
        initialized: false,
        amount: new BigNumber(0),
        reserved: new BigNumber(0),
      };
      this.spendableList.push(spendable);
    }

    this.dataOffset = dataBlobPtr;

    // Setup the rings
    const mining = this.setupMiningData(miningDataPtr);
    const orders = this.setupOrders(orderDataPtr, numOrders);
    const rings = this.assembleRings(numRings, ringDataPtr, orders);

    // Testing
    this.validateSpendables(orders);

    return [mining, orders, rings];
  }

  private setupMiningData(tablesPtr: number) {
    this.tableOffset = tablesPtr;
    const mining = new Mining(
      this.context,
      this.nextAddress(),
      this.nextAddress(),
      this.nextBytes(),
    );
    return mining;
  }

  private setupOrders(tablesPtr: number, numOrders: number) {
    this.tableOffset = tablesPtr;
    const orders: OrderInfo[] = [];
    for (let i = 0; i < numOrders; i++) {
      orders.push(this.assembleOrder());
    }
    return orders;
  }

  private assembleOrder() {
    const order: OrderInfo = {
      version: this.nextUint16(),
      owner: this.nextAddress(),
      tokenS: this.nextAddress(),
      tokenB: this.nextAddress(),
      amountS: this.nextUint().toNumber(),
      amountB: this.nextUint().toNumber(),
      validSince: this.nextUint32(),
      tokenSpendableS: this.spendableList[this.nextUint16()],
      tokenSpendableFee: this.spendableList[this.nextUint16()],
      dualAuthAddr: this.nextAddress(),
      broker: this.nextAddress(),
      orderInterceptor: this.nextAddress(),
      walletAddr: this.nextAddress(),
      validUntil: this.nextUint32(),
      sig: this.nextBytes(),
      dualAuthSig: this.nextBytes(),
      allOrNone: this.nextUint16() > 0,
      feeToken: this.nextAddress(),
      feeAmount: this.nextUint().toNumber(),
      waiveFeePercentage: this.toInt16(this.nextUint16()),
      tokenSFeePercentage: this.nextUint16(),
      tokenBFeePercentage: this.nextUint16(),
      tokenRecipient: this.nextAddress(),
      walletSplitPercentage: this.nextUint16(),
      tokenTypeS: this.nextUint16(),
      tokenTypeB: this.nextUint16(),
      tokenTypeFee: this.nextUint16(),
      trancheS: this.nextBytes32(),
      trancheB: this.nextBytes32(),
      transferDataS: this.nextBytes(),
    };

    if (this.context) {
      order.feeToken = order.feeToken ? order.feeToken : this.context.lrcAddress;
    }
    order.tokenRecipient = order.tokenRecipient ? order.tokenRecipient : order.owner;
    order.trancheS = order.trancheS ? order.trancheS : this.zeroBytes32;
    order.trancheB = order.trancheB ? order.trancheB : this.zeroBytes32;
    order.transferDataS = order.transferDataS ? order.transferDataS : "0x";
    return order;
  }

  private assembleRings(numRings: number, offset: number, orders: OrderInfo[]) {
    const rings: number[][] = [];
    for (let i = 0; i < numRings; i++) {
      const ringSize = this.data.extractUint8(offset);
      const ring = this.assembleRing(ringSize, offset + 1, orders);
      rings.push(ring);
      offset += 1 + 8;
    }
    return rings;
  }

  private assembleRing(ringSize: number, offset: number, orders: OrderInfo[]) {
    const ring: number[] = [];
    for (let i = 0; i < ringSize; i++) {
      const orderIndex = this.data.extractUint8(offset);
      offset += 1;
      ring.push(orderIndex);
    }

    return ring;
  }

  private getNextOffset() {
    const offset = this.data.extractUint16(this.tableOffset);
    this.tableOffset += 2;
    return offset;
  }

  private nextAddress() {
    const offset = this.getNextOffset() * 4;
    if (offset !== 0) {
      return web3.utils.toChecksumAddress(this.data.extractAddress(this.dataOffset + offset));
    } else {
      return undefined;
    }
  }

  private nextUint() {
    const offset = this.getNextOffset() * 4;
    if (offset !== 0) {
      return this.data.extractUint(this.dataOffset + offset);
    } else {
      return new BigNumber(0);
    }
  }

  private nextUint16() {
    const offset = this.getNextOffset();
    return offset;
  }

  private nextUint32() {
    const offset = this.getNextOffset() * 4;
    if (offset !== 0) {
      return this.data.extractUint32(this.dataOffset + offset);
    } else {
      return 0;
    }
  }

  private nextBytes() {
    const offset = this.getNextOffset() * 4;
    if (offset !== 0) {
      const len = this.data.extractUint(this.dataOffset + offset).toNumber();
      const data = "0x" + this.data.extractBytesX(this.dataOffset + offset + 32, len).toString("hex");
      return data;
    } else {
      return undefined;
    }
  }

  private nextBytes32() {
    const offset = this.getNextOffset() * 4;
    if (offset !== 0) {
      const data = "0x" + this.data.extractBytesX(this.dataOffset + offset, 32).toString("hex");
      return data;
    } else {
      return "0x" + "0".repeat(64);
    }
  }

  private toInt16(x: number) {
    // Check if the number is negative
    if (x >> 15 === 1) {
      const decoded = abi.rawDecode(["int16"], new Buffer("F".repeat(60) + x.toString(16), "hex"));
      return decoded.toString();
    } else {
      return x;
    }
  }

  private validateSpendables(orders: OrderInfo[]) {
    const ownerSpendables: { [id: string]: any; } = {};
    const brokerSpendables: { [id: string]: any; } = {};
    for (const order of orders) {
      // Token spendables
      if (!ownerSpendables[order.owner]) {
        ownerSpendables[order.owner] = {};
      }
      if (!ownerSpendables[order.owner][order.tokenS]) {
        ownerSpendables[order.owner][order.tokenS] = order.tokenSpendableS;
      }
      assert.equal(order.tokenSpendableS, ownerSpendables[order.owner][order.tokenS],
                   "Spendable for tokenS should match");
      if (!ownerSpendables[order.owner][order.feeToken]) {
        ownerSpendables[order.owner][order.feeToken] = order.tokenSpendableFee;
      }
      assert.equal(order.tokenSpendableFee, ownerSpendables[order.owner][order.feeToken],
                   "Spendable for feeToken should match");
    }
  }
}
