import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import { Context } from "./context";
import { ExchangeDeserializer } from "./exchange_deserializer";
import { Mining } from "./mining";
import { OrderUtil } from "./order";
import { Ring } from "./ring";
import { OrderInfo, RingMinedEvent, RingsInfo, SimulatorReport, TransferItem } from "./types";

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
                     transactionOrigin: string,
                     delegateContract: string) {
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
      order.hash = this.orderUtil.getOrderHash(order);
      await this.orderUtil.updateBrokerAndInterceptor(order);
      await this.orderUtil.checkBrokerSignature(order);
    }
    // await this.checkCutoffsOrders(orders);

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
    for (const ring of rings) {
      ring.checkOrdersValid();
      await ring.checkTokensRegistered();
      // console.log("~~~~~~~~~~~ring.valid:", ring.valid);
      if (ring.valid) {
        const ringReport = await this.simulateAndReportSingle(ring);
        ringMinedEvents.push(ringReport.ringMinedEvent);
        transferItems.push(...ringReport.transferItems);
      }
    }

    const simulatorReport: SimulatorReport = {
      ringMinedEvents,
      transferItems,
    };
    return simulatorReport;
  }

  private async simulateAndReportSingle(ring: Ring) {
    await ring.calculateFillAmountAndFee();
    const transferItems = ring.getRingTransferItems(this.walletSplitPercentage);
    const ringMinedEvent: RingMinedEvent = {
      ringIndex: new BigNumber(this.ringIndex++),
    };
    return {ringMinedEvent, transferItems};
  }

  private async checkCutoffsOrders(orders: OrderInfo[]) {
    const owners: string[] = [];
    const tradingPairs: Buffer[] = [];
    const validSince: number[] = [];

    for (const order of orders) {
        owners.push(order.owner);
        tradingPairs.push(new Buffer(this.xor(order.tokenS, order.tokenB, 20).slice(2), "hex"));
        validSince.push(order.validSince);
    }

    const cutoffsValid = await this.context.tradeDelegate.checkCutoffsBatch(owners, tradingPairs, validSince);
    console.log(cutoffsValid);
    console.log(cutoffsValid.toString(16));

    const bits = new BN(cutoffsValid.toString(16), 16);
    for (const [i, order] of orders.entries()) {
        order.valid = order.valid && bits.testn(i);
    }
  }

  private xor(s1: string, s2: string, numBytes: number) {
    const x1 = new BN(s1.slice(2), 16);
    const x2 = new BN(s2.slice(2), 16);
    const result = x1.xor(x2);
    return "0x" + result.toString(16, numBytes * 2);
  }
}
