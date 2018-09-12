import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { ensure } from "./ensure";
import { ExchangeDeserializer } from "./exchange_deserializer";
import { Mining } from "./mining";
import { OrderUtil } from "./order";
import { Ring } from "./ring";
import { OrderInfo, RingMinedEvent, RingsInfo, SimulatorReport, TransactionPayments, TransferItem } from "./types";
import { xor } from "./xor";

export class ProtocolSimulator {

  public context: Context;

  private ringIndex: number = 0;
  private orderUtil: OrderUtil;

  constructor(context: Context) {
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
      );
      rings.push(ring);
    }

    for (const order of orders) {
      order.valid = true;
      await this.orderUtil.validateInfo(order);
      this.orderUtil.checkP2P(order);
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
    }

    for (const order of orders) {
      await this.orderUtil.updateStates(order);
    }

    const ringMinedEvents: RingMinedEvent[] = [];
    const transferItems: TransferItem[] = [];
    const feeBalances: { [id: string]: any; } = {};
    for (const ring of rings) {
      ring.checkOrdersValid();
      ring.checkForSubRings();
      // await ring.checkTokensRegistered();
      if (ring.valid) {
        const ringReport = await this.simulateAndReportSingle(ring, mining, feeBalances);
        ringMinedEvents.push(ringReport.ringMinedEvent);
        transferItems.push(...ringReport.transferItems);
      }
    }

    // Simulate the token transfers of all rings
    const balances: { [id: string]: any; } = {};
    for (const transfer of transferItems) {
      if (!balances[transfer.token]) {
        balances[transfer.token] = {};
      }
      if (!balances[transfer.token][transfer.from]) {
        balances[transfer.token][transfer.from] = 0;
      }
      if (!balances[transfer.token][transfer.to]) {
        balances[transfer.token][transfer.to] = 0;
      }
      balances[transfer.token][transfer.from] -= transfer.amount;
      balances[transfer.token][transfer.to] += transfer.amount;
    }
    // Check if we haven't spent more funds than the owner owns
    for (const token of Object.keys(balances)) {
      for (const owner of Object.keys(balances[token])) {
        const spendable = await this.orderUtil.getERC20Spendable(this.context.tradeDelegate.address,
                                                                 token,
                                                                 owner);
        const finalBalance = spendable + balances[token][owner];
        const epsilon = 1000;
        assert(finalBalance >= -epsilon, "can't sell more tokens than the owner owns");
      }
    }

    const filledAmounts: { [hash: string]: number; } = {};
    for (const order of orders) {
      filledAmounts[order.hash.toString("hex")] = order.filledAmountS ? order.filledAmountS : 0;
    }

    const payments: TransactionPayments = {
      rings: [],
    };
    for (const ring of rings) {
      payments.rings.push(ring.payments);
    }

    const simulatorReport: SimulatorReport = {
      ringMinedEvents,
      transferItems,
      feeBalances,
      filledAmounts,
      payments,
    };
    return simulatorReport;
  }

  private async simulateAndReportSingle(ring: Ring, mining: Mining, feeBalances: { [id: string]: any; }) {
    await ring.calculateFillAmountAndFee();
    const transferItems = await ring.getRingTransferItems(mining, feeBalances);
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
        order.valid = order.valid && ensure(bits.testn(i), "order is cancelled or cut off");
    }
  }
}
