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

  private dataOffset: number = 12;
  private tableOffset: number = 0;

  constructor(context: Context) {
    this.context = context;
  }

  public deserialize(data: string): [Mining, OrderInfo[], number[][]] {

    this.data = new Bitstream(data);

    const version = this.data.extractUint16(0);
    const numOrders = this.data.extractUint16(2);
    const numRings = this.data.extractUint16(4);
    const numSpendables = this.data.extractUint16(6);

    this.tableOffset = 8;
    const ringsOffset = this.tableOffset + (3 + 25 * numOrders) * 2;
    this.dataOffset = ringsOffset + numRings * 9 + 32;

    this.spendableList = [];
    for (let i = 0; i < numSpendables; i++) {
      const spendable = {
        initialized: false,
        amount: 0,
        reserved: 0,
      };
      this.spendableList.push(spendable);
    }

    const mining = new Mining(
      this.context,
      this.nextAddress(),
      this.nextAddress(),
      this.nextBytes(),
    );

    const orders = this.assembleOrders(numOrders);
    const rings = this.assembleRings(numRings, ringsOffset, orders);

    // Testing
    this.validateSpendables(orders);

    return [mining, orders, rings];
  }

  private assembleOrders(numOrders: number) {
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
      feePercentage: this.nextUint16(),
      waiveFeePercentage: this.toInt16(this.nextUint16()),
      tokenSFeePercentage: this.nextUint16(),
      tokenBFeePercentage: this.nextUint16(),
      tokenRecipient: this.nextAddress(),
      walletSplitPercentage: this.nextUint16(),
    };
    order.feeToken = order.feeToken ? order.feeToken : this.context.lrcAddress;
    order.tokenRecipient = order.tokenRecipient ? order.tokenRecipient : order.owner;
    order.validUntil = order.validUntil > 0 ? order.validUntil : undefined;
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
      return this.data.extractAddress(this.dataOffset + offset);
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
