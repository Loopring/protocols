import { BigNumber } from "bignumber.js";
import { Mining } from "./mining";
import { OrderUtil } from "./order";
import { Ring } from "./ring";
import { OrderInfo, RingMinedEvent, RingsInfo, SimulatorReport, TransferItem } from "./types";

export class ProtocolSimulator {

  public walletSplitPercentage: number;

  private ringIndex: number = 0;
  private orderUtil = new OrderUtil();

  constructor(walletSplitPercentage: number) {
    this.walletSplitPercentage = walletSplitPercentage;
  }

  public async simulateAndReport(ringsInfo: RingsInfo, transactionOrigin: string) {

    for (const order of ringsInfo.orders) {
      order.valid = true;
      order.hash = this.orderUtil.getOrderHash(order);
      this.orderUtil.updateBrokerAndInterceptor(order);
      order.valid = order.valid && this.orderUtil.checkBrokerSignature(order);
    }

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

    for (const ring of rings) {
      ring.updateHash();
    }

    const mining = new Mining(
      ringsInfo.feeRecipient ? ringsInfo.feeRecipient : transactionOrigin,
      ringsInfo.miner,
      ringsInfo.sig,
    );
    mining.updateHash(rings);
    mining.updateMinerAndInterceptor();
    assert(mining.checkMinerSignature(transactionOrigin) === true, "Invalid miner signature");

    for (const order of ringsInfo.orders) {
      order.valid = order.valid && this.orderUtil.checkDualAuthSignature(order, mining.hash);
    }

    const ringMinedEvents: RingMinedEvent[] = [];
    for (const ring of rings) {
      ring.valid = ring.valid && ring.checkOrdersValid();
      if (ring.valid) {
        const ringMinedEvent = await this.simulateAndReportSingle(ring);
        ringMinedEvents.push(ringMinedEvent);
      }
    }

    const simulatorReport: SimulatorReport = {
      ringMinedEvents,
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
    return ringMinedEvent;
  }
}
