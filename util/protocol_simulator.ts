import { BigNumber } from "bignumber.js";
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
  private orderUtil = new OrderUtil();

  constructor(walletSplitPercentage: number, context: Context) {
    this.walletSplitPercentage = walletSplitPercentage;
    this.context = context;
  }

  public deserialize(data: string,
                     transactionOrigin: string,
                     delegateContract: string) {
    const exchangeDeserializer = new ExchangeDeserializer(this.context.brokerRegistryAddress);
    const [mining, orders, rings] = exchangeDeserializer.deserialize(data);

    // Current JS implementation depends on this being set
    for (const order of orders) {
      order.delegateContract = delegateContract;
    }

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
      ringsInfo.feeRecipient ? ringsInfo.feeRecipient : ringsInfo.transactionOrigin,
      this.context.brokerRegistryAddress,
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
      const ring = new Ring(ringOrders, ringsInfo.miner, ringsInfo.feeRecipient);
      rings.push(ring);
    }

    for (const order of orders) {
      order.valid = true;
      order.hash = this.orderUtil.getOrderHash(order);
      this.orderUtil.updateBrokerAndInterceptor(order);
      // order.valid = order.valid && this.orderUtil.checkBrokerSignature(order);
    }

    for (const ring of rings) {
      ring.updateHash();
    }

    mining.updateHash(rings);
    await mining.updateMinerAndInterceptor();
    // assert(mining.checkMinerSignature(ringsInfo.transactionOrigin) === true,
    //        "Invalid miner signature");

    // for (const order of orders) {
    //   order.valid = order.valid && this.orderUtil.checkDualAuthSignature(order, mining.hash);
    //   console.log("order.valid:", order.valid);
    // }

    const ringMinedEvents: RingMinedEvent[] = [];
    const transferItems: TransferItem[] = [];
    for (const ring of rings) {
      ring.valid = ring.valid && ring.checkOrdersValid();
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

    transferItems.forEach((item) => console.log(item));

    const ringMinedEvent: RingMinedEvent = {
      ringIndex: new BigNumber(this.ringIndex++),
    };
    return {ringMinedEvent, transferItems};
  }
}
