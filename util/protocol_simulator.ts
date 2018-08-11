import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { ExchangeDeserializer } from "./exchange_deserializer";
import { Mining } from "./mining";
import { OrderUtil } from "./order";
import { Ring } from "./ring";
import { OrderInfo, RingMinedEvent, RingsInfo, SimulatorReport, TransferItem } from "./types";
import { xor } from "./xor";

export class ProtocolSimulator {

  public walletSplitPercentage: number;
  public context: Context;

  private ringIndex: number = 0;
  private orderUtil: OrderUtil;

  constructor(walletSplitPercentage: number, context: Context) {
    this.walletSplitPercentage = walletSplitPercentage;
    this.context = context;
    this.orderUtil = new OrderUtil(context);
  }

  public deserialize(data: string,
                     transactionOrigin: string) {
    const exchangeDeserializer = new ExchangeDeserializer(this.context);
    const [mining, orders, rings] = exchangeDeserializer.deserialize(data);

    const ringsInfo: RingsInfo = {
      rings,
      orders,
      feeRecipient: mining.feeRecipient,
      miner: mining.miner,
      sig: mining.sig,
      transactionOrigin,
    };
    return ringsInfo;
  }

  public async simulateAndReport(ringsInfo: RingsInfo) {
    const mining = new Mining(
      this.context,
      ringsInfo.feeRecipient ? ringsInfo.feeRecipient : ringsInfo.transactionOrigin,
      ringsInfo.miner,
      ringsInfo.sig,
    );

    const orders = ringsInfo.orders;

    const rings: Ring[] = [];
    for (const indexes of ringsInfo.rings) {
      const ringOrders: OrderInfo[] = [];
      for (const orderIndex of indexes) {
        const orderInfo = ringsInfo.orders[orderIndex];
        ringOrders.push(orderInfo);
      }
      const ring = new Ring(
        this.context,
        ringOrders,
        ringsInfo.miner,
        ringsInfo.feeRecipient,
      );
      rings.push(ring);
    }

    for (const order of orders) {
      order.valid = true;
      await this.orderUtil.validateInfo(order);
      order.hash = this.orderUtil.getOrderHash(order);
      await this.orderUtil.updateBrokerAndInterceptor(order);
      await this.orderUtil.checkBrokerSignature(order);
    }
    await this.checkCutoffsAndCancelledOrders(orders);

    for (const ring of rings) {
      ring.updateHash();
    }

    mining.updateHash(rings);
    await mining.updateMinerAndInterceptor();
    assert(mining.checkMinerSignature(ringsInfo.transactionOrigin) === true,
           "Invalid miner signature");

    for (const order of orders) {
      this.orderUtil.checkDualAuthSignature(order, mining.hash);
      // console.log("order.valid:", order.valid);
    }

    const ringMinedEvents: RingMinedEvent[] = [];
    const transferItems: TransferItem[] = [];
    const feeBalances: { [id: string]: any; } = {};
    for (const ring of rings) {
      ring.checkOrdersValid();
      await ring.checkTokensRegistered();
      // console.log("~~~~~~~~~~~ring.valid:", ring.valid);
      if (ring.valid) {
        const ringReport = await this.simulateAndReportSingle(ring, feeBalances);
        ringMinedEvents.push(ringReport.ringMinedEvent);
        transferItems.push(...ringReport.transferItems);
      }
    }

    const simulatorReport: SimulatorReport = {
      ringMinedEvents,
      transferItems,
      feeBalances,
    };
    return simulatorReport;
  }

  private async simulateAndReportSingle(ring: Ring, feeBalances: { [id: string]: any; }) {
    await ring.calculateFillAmountAndFee();
    const transferItems = await ring.getRingTransferItems(this.walletSplitPercentage, feeBalances);
    const ringMinedEvent: RingMinedEvent = {
      ringIndex: new BigNumber(this.ringIndex++),
    };
    return {ringMinedEvent, transferItems};
  }

  private async checkCutoffsAndCancelledOrders(orders: OrderInfo[]) {
    const bitstream = new Bitstream();
    for (const order of orders) {
      bitstream.addAddress(order.owner, 32);
      bitstream.addHex(order.hash.toString("hex"));
      bitstream.addNumber(order.validSince, 32);
      bitstream.addHex(xor(order.tokenS, order.tokenB, 20));
      bitstream.addNumber(0, 12);
    }

    const ordersValid = await this.context.tradeDelegate.batchCheckCutoffsAndCancelled(bitstream.getBytes32Array());

    const bits = new BN(ordersValid.toString(16), 16);
    for (const [i, order] of orders.entries()) {
        order.valid = order.valid && bits.testn(i);
    }
  }
}
