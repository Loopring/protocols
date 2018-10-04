import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { ensure } from "./ensure";
import { ExchangeDeserializer } from "./exchange_deserializer";
import { Mining } from "./mining";
import { OrderUtil } from "./order";
import { Ring } from "./ring";
import { OrderInfo, RingMinedEvent, RingsInfo, SimulatorReport, Spendable,
         TransactionPayments, TransferItem } from "./types";
import { xor } from "./xor";

export class ProtocolSimulator {

  public context: Context;
  public offLineMode: boolean = false;

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
    }
    await this.batchGetFilledAndCheckCancelled(orders);
    this.updateBrokerSpendables(orders);
    for (const order of orders) {
      await this.orderUtil.checkBrokerSignature(order);
    }

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

    const ringMinedEvents: RingMinedEvent[] = [];
    const transferItems: TransferItem[] = [];
    const feeBalances: { [id: string]: any; } = {};
    for (const ring of rings) {
      ring.checkOrdersValid();
      ring.checkForSubRings();
      await ring.calculateFillAmountAndFee();
      if (ring.valid) {
        ring.adjustOrderStates();
      }
    }

    for (const order of orders) {
      // Check if this order needs to be completely filled
      if (order.allOrNone) {
        order.valid = order.valid && (order.filledAmountS === order.amountS);
      }
    }

    for (const ring of rings) {
      const validBefore = ring.valid;
      ring.checkOrdersValid();
      if (ring.valid) {
        const ringReport = await this.simulateAndReportSingle(ring, mining, feeBalances);
        ringMinedEvents.push(ringReport.ringMinedEvent);
        // Merge transfer items if possible
        for (const ringTransferItem of ringReport.transferItems) {
          let addNew = true;
          for (const transferItem of transferItems) {
            if (transferItem.token === ringTransferItem.token &&
                transferItem.from === ringTransferItem.from &&
                transferItem.to === ringTransferItem.to) {
                transferItem.amount += ringTransferItem.amount;
                addNew = false;
            }
          }
          if (addNew) {
            transferItems.push(ringTransferItem);
          }
        }
      } else {
        // If the ring was valid before the completely filled check we have to revert the filled amountS
        // of the orders in the ring. This is a bit awkward so maybe there's a better solution.
        if (validBefore) {
          for (const p of ring.participations) {
                p.order.filledAmountS = p.order.filledAmountS - (p.fillAmountS + p.splitS);
                assert(p.order.filledAmountS >= 0, "p.order.filledAmountS >= 0");
            }
        }
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
      let filledAmountS = order.filledAmountS ? order.filledAmountS : 0;
      if (!order.valid) {
        filledAmountS = await this.context.tradeDelegate.filled("0x" + order.hash.toString("hex")).toNumber();
      }
      filledAmounts[order.hash.toString("hex")] = filledAmountS;
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
    const transferItems = await ring.doPayments(mining, feeBalances);
    const ringMinedEvent: RingMinedEvent = {
      ringIndex: new BigNumber(this.ringIndex++),
    };
    return {ringMinedEvent, transferItems};
  }

  private async batchGetFilledAndCheckCancelled(orders: OrderInfo[]) {
    const bitstream = new Bitstream();
    for (const order of orders) {
      bitstream.addAddress(order.broker, 32);
      bitstream.addAddress(order.owner, 32);
      bitstream.addHex(order.hash.toString("hex"));
      bitstream.addNumber(order.validSince, 32);
      bitstream.addHex(xor(order.tokenS, order.tokenB, 20));
      bitstream.addNumber(0, 12);
    }

    const fills = await this.context.tradeDelegate.batchGetFilledAndCheckCancelled(bitstream.getBytes32Array());

    const cancelledValue = new BigNumber("F".repeat(64), 16);
    for (const [i, order] of orders.entries()) {
      order.filledAmountS = fills[i].toNumber();
      order.valid = order.valid && ensure(!fills[i].equals(cancelledValue), "order is cancelled");
    }
  }

  private updateBrokerSpendables(orders: OrderInfo[]) {
    // Spendables for brokers need to be setup just right for the allowances to work, we cannot trust
    // the miner to do this for us. Spendables for tokens don't need to be correct, if they are incorrect
    // the transaction will fail, so the miner will want to send those correctly.
    interface BrokerSpendable {
      broker: string;
      owner: string;
      token: string;
      spendable: Spendable;
    }

    const brokerSpendables: BrokerSpendable[] = [];
    const addBrokerSpendable = (broker: string, owner: string, token: string) => {
      // Find an existing one
      for (const spendable of brokerSpendables) {
        if (spendable.broker === broker && spendable.owner === owner && spendable.token === token) {
          return spendable.spendable;
        }
      }
      // Create a new one
      const newSpendable = {
        initialized: false,
        amount: 0,
        reserved: 0,
      };
      const newBrokerSpendable = {
        broker,
        owner,
        token,
        spendable: newSpendable,
      };
      brokerSpendables.push(newBrokerSpendable);
      return newBrokerSpendable.spendable;
    };

    for (const order of orders) {
      if (order.brokerInterceptor) {
        order.brokerSpendableS = addBrokerSpendable(order.broker, order.owner, order.tokenS);
        order.brokerSpendableFee = addBrokerSpendable(order.broker, order.owner, order.feeToken);
      }
    }
  }
}
