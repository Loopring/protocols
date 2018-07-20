import { Ring } from "./ring";
import { OrderInfo, RingsInfo, TransferItem } from "./types";

export class ProtocolSimulator {

  public async simulateAndReport(ringsInfo: RingsInfo) {
    for (const indexes of ringsInfo.rings) {
      const ringOrders: OrderInfo[] = [];
      for (const orderIndex of indexes) {
        const orderInfo = ringsInfo.orders[orderIndex];
        ringOrders.push(orderInfo);
      }

      const ring = new Ring(ringOrders, ringsInfo.miner, ringsInfo.feeRecipient);
      await this.simulateAndReportSingle(ring);
    }
  }

  private async simulateAndReportSingle(ring: Ring) {
    await ring.calculateFillAmountAndFee();
    const transferItems = ring.getRingTransferItems();

    transferItems.forEach((item) => console.log(item));
  }
}
