import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import abi = require("ethereumjs-abi");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { EncodeSpec } from "./encode_spec";
import { Mining } from "./mining";
import { MiningSpec } from "./mining_spec";
import { OrderUtil } from "./order";
import { OrderSpec } from "./order_spec";
import { ParticipationSpec } from "./participation_spec";
import { Ring } from "./ring";
import { OrderInfo, RingMinedEvent, RingsInfo, SimulatorReport, Spendable, TransferItem } from "./types";

export class ExchangeDeserializer {

  private context: Context;

  private data: Bitstream;
  private spendableList?: Spendable[];
  private bytesOffset: number = 0;

  constructor(context: Context) {
    this.context = context;
  }

  public deserialize(data: string): [Mining, OrderInfo[], number[][]] {

    this.data = new Bitstream(data);

    const numOrders = this.data.extractUint16(0);
    const numRings = this.data.extractUint16(2);
    const numSpendables = this.data.extractUint16(4);
    const dataLength = this.data.extractUint16(6);

    let offset = 2 * 4;

    const miningSpec = new MiningSpec(this.data.extractUint16(offset));
    offset += 2;

    const orderOffset = offset;
    offset += 2 * numOrders;

    this.bytesOffset = offset;
    offset += dataLength;

    const ringSpecsOffset = offset;

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
      (miningSpec.hasFeeRecipient() ? this.nextAddress() : undefined),
      (miningSpec.hasMiner() ? this.nextAddress() : undefined),
      (miningSpec.hasSignature() ? this.nextBytes() : undefined),
    );

    const orders = this.assembleOrders(numOrders, orderOffset);
    const rings = this.assembleRings(numRings, ringSpecsOffset, orders);

    this.validateSpendables(orders);

    return [mining, orders, rings];
  }

  private assembleOrders(numOrders: number, offset: number) {
    const orders: OrderInfo[] = [];
    for (let i = 0; i < numOrders; i++) {
      const spec = this.data.extractUint16(offset + i * 2);
      orders.push(this.assembleOrder(spec));
    }
    return orders;
  }

  private assembleOrder(specData: number) {
    const spec = new OrderSpec(specData);
    const order: OrderInfo = {
      owner: this.nextAddress(),
      tokenS: this.nextAddress(),
      tokenB: null,
      amountS: this.nextUint().toNumber(),
      amountB: this.nextUint().toNumber(),
      validSince: this.nextUint().toNumber(),
      tokenSpendableS: this.spendableList[this.nextUint16()],
      tokenSpendableFee: this.spendableList[this.nextUint16()],
      dualAuthAddr: spec.hasDualAuth() ? this.nextAddress() : undefined,
      broker: spec.hasBroker() ? this.nextAddress() : undefined,
      brokerSpendableS: spec.hasBroker() ? this.spendableList[this.nextUint16()] : undefined,
      brokerSpendableFee: spec.hasBroker() ? this.spendableList[this.nextUint16()] : undefined,
      orderInterceptor: spec.hasOrderInterceptor() ? this.nextAddress() : undefined,
      walletAddr: spec.hasWallet() ? this.nextAddress() : undefined,
      validUntil: spec.hasValidUntil() ? this.nextUint().toNumber() : undefined,
      sig: spec.hasSignature() ? this.nextBytes() : undefined,
      dualAuthSig: spec.hasDualAuthSig() ? this.nextBytes() : undefined,
      allOrNone: spec.allOrNone(),
      feeToken: spec.hasFeeToken() ? this.nextAddress() : this.context.lrcAddress,
      feeAmount: spec.hasFeeAmount() ? this.nextUint().toNumber() : 0,
      feePercentage: spec.hasFeePercentage() ? this.nextUint16() : 0,
      waiveFeePercentage: spec.hasWaiveFeePercentage() ? this.toInt16(this.nextUint16()) : 0,
      tokenSFeePercentage: spec.hasTokenSFeePercentage() ? this.nextUint16() : 0,
      tokenBFeePercentage: spec.hasTokenBFeePercentage() ? this.nextUint16() : 0,
      tokenRecipient: spec.hasTokenRecipient() ? this.nextAddress() : undefined,
      walletSplitPercentage: spec.hasWalletSplitPercentage() ? this.nextUint16() : 0,
    };
    order.tokenRecipient = order.tokenRecipient ? order.tokenRecipient : order.owner;
    return order;
  }

  private assembleRings(numRings: number, offset: number, orders: OrderInfo[]) {
    const rings: number[][] = [];
    for (let i = 0; i < numRings; i++) {
      const ringSize = this.data.extractUint8(offset);
      const ring = this.assembleRing(ringSize, offset + 1, orders);
      rings.push(ring);
      offset += 1 + ringSize;
    }
    return rings;
  }

  private assembleRing(ringSize: number, offset: number, orders: OrderInfo[]) {
    const ring: number[] = [];
    for (let i = 0; i < ringSize; i++) {
      const specData = this.data.extractUint8(offset);
      offset += 1;
      const pspec = new ParticipationSpec(specData);
      ring.push(pspec.orderIndex());
    }

    // Set tokenB of orders using the tokenS from the next order
    for (let i = 0; i < ring.length; i++) {
      orders[ring[i]].tokenB = orders[ring[(i + 1) % ring.length]].tokenS;
    }

    return ring;
  }

  private nextAddress() {
    const value = this.data.extractAddress(this.bytesOffset);
    this.bytesOffset += 20;
    return value;
  }

  private nextUint() {
    const value = this.data.extractUint(this.bytesOffset);
    this.bytesOffset += 32;
    return value;
  }

  private nextUint16() {
    const value = this.data.extractUint16(this.bytesOffset);
    this.bytesOffset += 2;
    return value;
  }

  private nextBytes() {
    const len = this.data.extractUint(this.bytesOffset).toNumber();
    const data = "0x" + this.data.extractBytesX(this.bytesOffset + 32, len).toString("hex");
    this.bytesOffset += 32 + len;
    return data;
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
      // Broker allowances
      if (order.broker) {
        if (!brokerSpendables[order.owner]) {
          brokerSpendables[order.owner] = {};
        }
        if (!brokerSpendables[order.owner][order.broker]) {
          brokerSpendables[order.owner][order.broker] = {};
        }
        if (!brokerSpendables[order.owner][order.broker][order.tokenS]) {
          brokerSpendables[order.owner][order.broker][order.tokenS] = order.brokerSpendableS;
        }
        assert.equal(order.brokerSpendableS, brokerSpendables[order.owner][order.broker][order.tokenS],
                     "broker spendable for tokenS should match");
        if (!brokerSpendables[order.owner][order.broker][order.feeToken]) {
          brokerSpendables[order.owner][order.broker][order.feeToken] = order.brokerSpendableFee;
        }
        assert.equal(order.brokerSpendableFee, brokerSpendables[order.owner][order.broker][order.feeToken],
                     "broker spendable for tokenFee should match");
      }
    }
  }
}
