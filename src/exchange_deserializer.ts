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

  private data: string;

  private addressList?: string[];
  private uintList?: BigNumber[];
  private uint16List?: number[];
  private bytesList?: string[];
  private spendableList?: Spendable[];

  private addressListIdx: number = 0;
  private uintListIdx: number = 0;
  private uint16ListIdx: number = 0;
  private bytesListIdx: number = 0;

  constructor(context: Context) {
    this.context = context;
  }

  public deserialize(data: string): [Mining, OrderInfo[], number[][]] {

    const bitstream = new Bitstream(data);

    const encodeSpecsLen = bitstream.extractUint16(0);
    let offset = 2;
    const encodeSpecs = new EncodeSpec(bitstream.copyToUint16Array(offset, encodeSpecsLen));
    offset += 2 * encodeSpecsLen;

    const miningSpec = new MiningSpec(bitstream.extractUint16(offset));
    offset += 2;
    const orderSpecs = bitstream.copyToUint16Array(offset, encodeSpecs.orderSpecSize());
    offset += 2 * encodeSpecs.orderSpecSize();

    const ringSpecs = bitstream.copyToUint8ArrayList(offset, encodeSpecs.ringSpecSizeArray());
    offset += 1 * encodeSpecs.ringSpecsDataLen();

    this.addressList = bitstream.copyToAddressArray(offset, encodeSpecs.addressListSize());
    offset += 20 * encodeSpecs.addressListSize();

    this.uintList = bitstream.copyToUintArray(offset, encodeSpecs.uintListSize());
    offset += 32 * encodeSpecs.uintListSize();

    this.uint16List = bitstream.copyToUint16Array(offset, encodeSpecs.uint16ListSize());
    offset += 2 * encodeSpecs.uint16ListSize();

    this.bytesList = bitstream.copyToBytesArray(offset, encodeSpecs.bytesListSizeArray());

    this.spendableList = [];
    for (let i = 0; i < encodeSpecs.spendableListSize(); i++) {
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

    const orders = this.assembleOrders(orderSpecs);
    const rings = this.assembleRings(ringSpecs, orders);

    this.validateSpendables(orders);

    return [mining, orders, rings];
  }

  private assembleOrders(specs: number[]) {
    const size = specs.length;
    const orders: OrderInfo[] = [];
    for (let i = 0; i < size; i++) {
      orders.push(this.assembleOrder(specs[i]));
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
    };
    order.tokenRecipient = order.tokenRecipient ? order.tokenRecipient : order.owner;
    return order;
  }

  private assembleRings(specs: number[][], orders: OrderInfo[]) {
    const size = specs.length;
    const rings: number[][] = [];
    for (let i = 0; i < size; i++) {
      rings.push(this.assembleRing(specs[i], orders));
    }
    return rings;
  }

  private assembleRing(pspecs: number[], orders: OrderInfo[]) {
    const size = pspecs.length;

    const ring: number[] = [];
    for (let i = 0; i < size; i++) {
      const pspec = new ParticipationSpec(pspecs[i]);
      const order = orders[pspec.orderIndex()];
      ring.push(pspec.orderIndex());
    }

    // Set tokenB of orders using the tokenS from the next order
    for (let i = 0; i < ring.length; i++) {
      orders[ring[i]].tokenB = orders[ring[(i + 1) % ring.length]].tokenS;
    }

    return ring;
  }

  private nextAddress() {
    return this.addressList[this.addressListIdx++];
  }

  private nextUint() {
    return this.uintList[this.uintListIdx++];
  }

  private nextUint16() {
    return this.uint16List[this.uint16ListIdx++];
  }

  private nextBytes() {
    return this.bytesList[this.bytesListIdx++];
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
