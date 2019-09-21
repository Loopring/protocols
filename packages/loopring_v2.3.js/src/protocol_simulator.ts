import { BigNumber } from "bignumber.js";
import BN = require("bn.js");
import { Bitstream } from "./bitstream";
import { Context } from "./context";
import { ensure } from "./ensure";
import { ExchangeDeserializer } from "./exchange_deserializer";
import { Mining } from "./mining";
import { OrderUtil } from "./order";
import { Ring } from "./ring";
import { InvalidRingEvent, OrderInfo, RingMinedEvent, RingsInfo, SimulatorReport, Spendable,
         TransactionPayments, TransferItem } from "./types";
import { xor } from "./xor";

export class ProtocolSimulator {

  context: Context;
  offLineMode = false;

  private orderUtil: OrderUtil;

  constructor(context: Context) {
    this.context = context;
    this.orderUtil = new OrderUtil(context);
  }

  deserialize(data: string,
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

  async simulateAndReport(ringsInfo: RingsInfo) {

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
    for (let i = 0; i < orders.length; i++) {
      // An order can only be sent once
      for (let j = i + 1; j < orders.length; j++) {
        assert(orders[i].hash !== orders[j].hash, "INVALID_VALUE");
      }
    }

    for (const ring of rings) {
      ring.updateHash();
    }

    mining.updateHash(rings);
    await mining.updateMinerAndInterceptor();
    assert(mining.checkMinerSignature(ringsInfo.transactionOrigin) === true,
           "INVALID_SIG");

    for (const order of orders) {
      this.orderUtil.checkDualAuthSignature(order, mining.hash);
    }

    const ringMinedEvents: RingMinedEvent[] = [];
    const invalidRingEvents: InvalidRingEvent[] = [];
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

    // Check if the allOrNone orders are completely filled over all rings
    // This can invalidate rings
    this.checkRings(orders, rings);

    for (const ring of rings) {
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
                transferItem.amount = transferItem.amount.plus(ringTransferItem.amount);
                addNew = false;
            }
          }
          if (addNew) {
            transferItems.push(ringTransferItem);
          }
        }
      } else {
        const invalidRingEvent: InvalidRingEvent = {
          ringHash: "0x" + ring.hash.toString("hex"),
        };
        invalidRingEvents.push(invalidRingEvent);
      }
    }

    const report = await this.collectReport(ringsInfo,
                                           mining,
                                           rings,
                                           transferItems,
                                           feeBalances,
                                           ringMinedEvents,
                                           invalidRingEvents);

    await this.validateRings(ringsInfo, report);

    return report;
  }

  private async checkRings(orders: OrderInfo[], rings: Ring[]) {
    // Check if allOrNone orders are completely filled
    // When a ring is turned invalid because of an allOrNone order we have to
    // recheck the other rings again because they may contain other allOrNone orders
    // that may not be completely filled anymore.
    let reevaluateRings = true;
    while (reevaluateRings) {
      reevaluateRings = false;
      for (const order of orders) {
        // Check if this order needs to be completely filled
        if (order.allOrNone) {
          const validBefore = order.valid;
          this.orderUtil.validateAllOrNone(order);
          // Check if the order valid status has changed
          reevaluateRings = reevaluateRings || (validBefore !== order.valid);
        }
      }
      if (reevaluateRings) {
        for (const ring of rings) {
          const validBefore = ring.valid;
          ring.checkOrdersValid();
          // If the ring was valid before the completely filled check we have to revert the filled amountS
          // of the orders in the ring. This is a bit awkward so maybe there's a better solution.
          if (!ring.valid && validBefore) {
            ring.revertOrderStats();
          }
        }
      }
    }
  }

  private async simulateAndReportSingle(ring: Ring, mining: Mining, feeBalances: { [id: string]: any; }) {
    const transferItems = await ring.doPayments(mining, feeBalances);
    const fills = ring.generateFills();
    const ringMinedEvent: RingMinedEvent = {
      ringIndex: new BigNumber(this.context.ringIndex++),
      ringHash: "0x" + ring.hash.toString("hex"),
      feeRecipient: mining.feeRecipient,
      fills,
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

    const fills = await this.context.tradeHistory.methods.batchGetFilledAndCheckCancelled(
      bitstream.getBytes32Array(),
    ).call();

    const cancelledValue = new BN("F".repeat(64), 16);
    for (const [i, order] of orders.entries()) {
      const fillBN = new BN(new BigNumber(fills[i].toString(16)).toString(16), 16);
      order.filledAmountS = new BigNumber(fillBN.toString());
      order.valid = order.valid && ensure(
        !fillBN.eq(cancelledValue),
        "order is cancelled",
      );
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
        amount: new BigNumber(0),
        reserved: new BigNumber(0),
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

  private async collectReport(ringsInfo: RingsInfo,
                              mining: Mining,
                              rings: Ring[],
                              transferItems: TransferItem[],
                              feeBalances: { [id: string]: any; },
                              ringMinedEvents: RingMinedEvent[],
                              invalidRingEvents: InvalidRingEvent[]) {
    const orders = ringsInfo.orders;

    // Collect balances before the transaction
    const balancesBefore: { [id: string]: any; } = {};
    for (const order of orders) {
      if (!balancesBefore[order.tokenS]) {
        balancesBefore[order.tokenS] = {};
      }
      if (!balancesBefore[order.tokenB]) {
        balancesBefore[order.tokenB] = {};
      }
      if (!balancesBefore[order.feeToken]) {
        balancesBefore[order.feeToken] = {};
      }
      if (!balancesBefore[order.tokenS][order.owner]) {
        balancesBefore[order.tokenS][order.owner] =
          await this.orderUtil.getERC20Spendable(this.context.tradeDelegate.options.address,
                                                  order.tokenS,
                                                  order.owner);
      }
      if (!balancesBefore[order.tokenB][order.tokenRecipient]) {
        balancesBefore[order.tokenB][order.tokenRecipient] =
          await this.orderUtil.getERC20Spendable(this.context.tradeDelegate.options.address,
                                                 order.tokenB,
                                                 order.tokenRecipient);
      }
      if (!balancesBefore[order.feeToken][order.owner]) {
        balancesBefore[order.feeToken][order.owner] =
          await this.orderUtil.getERC20Spendable(this.context.tradeDelegate.options.address,
                                                 order.feeToken,
                                                 order.owner);
      }
    }
    for (const order of orders) {
      const tokens = [order.tokenS, order.tokenB, order.feeToken];
      for (const token of tokens) {
        const Token = this.context.ERC20Contract;
        Token.options.address = order.tokenS;
        // feeRecipient
        if (!balancesBefore[token][mining.feeRecipient]) {
          balancesBefore[token][mining.feeRecipient] =
            new BigNumber((await Token.methods.balanceOf(mining.feeRecipient).call()).toString());
        }
      }
    }

    // Simulate the token transfers of all rings
    const balanceDeltas: { [id: string]: any; } = {};
    for (const transfer of transferItems) {
      if (!balanceDeltas[transfer.token]) {
        balanceDeltas[transfer.token] = {};
      }
      if (!balanceDeltas[transfer.token][transfer.from]) {
        balanceDeltas[transfer.token][transfer.from] = new BigNumber(0);
      }
      if (!balanceDeltas[transfer.token][transfer.to]) {
        balanceDeltas[transfer.token][transfer.to] = new BigNumber(0);
      }
      balanceDeltas[transfer.token][transfer.from] =
        balanceDeltas[transfer.token][transfer.from].minus(transfer.amount);
      balanceDeltas[transfer.token][transfer.to] =
        balanceDeltas[transfer.token][transfer.to].plus(transfer.amount);
    }

    // Calculate the balances after the transaction
    const balancesAfter: { [id: string]: any; } = {};
    for (const token of Object.keys(balancesBefore)) {
      for (const owner of Object.keys(balancesBefore[token])) {
        if (!balancesAfter[token]) {
          balancesAfter[token] = {};
        }
        const delta = (balanceDeltas[token] && balanceDeltas[token][owner]) ?
                      balanceDeltas[token][owner] : new BigNumber(0);
        balancesAfter[token][owner] = balancesBefore[token][owner].plus(delta);
      }
    }

    // Get the fee balances before the transaction
    const feeBalancesBefore: { [id: string]: any; } = {};
    for (const order of orders) {
      const tokens = [order.tokenS, order.tokenB, order.feeToken];
      for (const token of tokens) {
        if (!feeBalancesBefore[token]) {
          feeBalancesBefore[token] = {};
        }
        const feeHolderMethods = this.context.feeHolder.methods;
        // Owner
        if (!feeBalancesBefore[token][order.owner]) {
          feeBalancesBefore[token][order.owner] =
            new BigNumber((await feeHolderMethods.feeBalances(token, order.owner).call()).toString());
        }
        // Wallet
        if (order.walletAddr && !feeBalancesBefore[token][order.walletAddr]) {
          feeBalancesBefore[token][order.walletAddr] =
            new BigNumber((await feeHolderMethods.feeBalances(token, order.walletAddr).call()).toString());
        }
        // FeeRecipient
        if (!feeBalancesBefore[token][mining.feeRecipient]) {
          feeBalancesBefore[token][mining.feeRecipient] =
            new BigNumber((await feeHolderMethods.feeBalances(token, mining.feeRecipient).call()).toString());
        }
        // Burned
        const feeHolder = this.context.feeHolder.options.address;
        if (!feeBalancesBefore[token][feeHolder]) {
          feeBalancesBefore[token][feeHolder] =
            new BigNumber((await feeHolderMethods.feeBalances(token, feeHolder).call()).toString());
        }
      }
    }

    // Calculate the balances after the transaction
    const feeBalancesAfter: { [id: string]: any; } = {};
    for (const token of Object.keys(feeBalancesBefore)) {
      for (const owner of Object.keys(feeBalancesBefore[token])) {
        if (!feeBalancesAfter[token]) {
          feeBalancesAfter[token] = {};
        }
        const delta = (feeBalances[token] && feeBalances[token][owner]) ?
                      feeBalances[token][owner] : new BigNumber(0);
        feeBalancesAfter[token][owner] = feeBalancesBefore[token][owner].plus(delta);
      }
    }

    // Get the filled amounts before
    const filledAmountsBefore: { [hash: string]: BigNumber; } = {};
    for (const order of orders) {
      const orderHash = order.hash.toString("hex");
      filledAmountsBefore[orderHash] =
        new BigNumber((await this.context.tradeHistory.methods.filled("0x" + orderHash).call()).toString());
    }

    // Filled amounts after
    const filledAmountsAfter: { [hash: string]: BigNumber; } = {};
    for (const order of orders) {
      const orderHash = order.hash.toString("hex");
      let filledAmountS = order.filledAmountS ? order.filledAmountS : new BigNumber(0);
      if (!order.valid) {
        filledAmountS = filledAmountsBefore[orderHash];
      }
      filledAmountsAfter[orderHash] = filledAmountS;
    }

    // Collect the payments
    const payments: TransactionPayments = {
      rings: [],
    };
    for (const ring of rings) {
      payments.rings.push(ring.payments);
    }

    // Create the report
    const simulatorReport: SimulatorReport = {
      reverted: false,
      ringMinedEvents,
      invalidRingEvents,
      transferItems,
      feeBalancesBefore,
      feeBalancesAfter,
      filledAmountsBefore,
      filledAmountsAfter,
      balancesBefore,
      balancesAfter,
      payments,
    };
    return simulatorReport;
  }

  private async validateRings(ringsInfo: RingsInfo,
                              report: SimulatorReport) {
    const orders = ringsInfo.orders;

    // Check if we haven't spent more funds than the owner owns
    for (const token of Object.keys(report.balancesAfter)) {
      for (const owner of Object.keys(report.balancesAfter[token])) {
        assert(report.balancesAfter[token][owner] >= 0, "can't sell more tokens than the owner owns");
      }
    }

    // Check if the spendables were updated correctly
    for (const order of orders) {
      if (order.tokenSpendableS.initialized) {
        let amountTransferredS = new BigNumber(0);
        for (const transfer of report.transferItems) {
          if (transfer.from === order.owner && transfer.token === order.tokenS) {
            amountTransferredS = amountTransferredS.plus(transfer.amount);
          }
        }
        const amountSpentS = order.tokenSpendableS.initialAmount.minus(order.tokenSpendableS.amount);
        // amountTransferred could be less than amountSpent because of rebates
        assert(amountSpentS.gte(amountTransferredS), "amountSpentS >= amountTransferredS");
      }
      if (order.tokenSpendableFee.initialized) {
        let amountTransferredFee = new BigNumber(0);
        for (const transfer of report.transferItems) {
          if (transfer.from === order.owner && transfer.token === order.feeToken) {
            amountTransferredFee = amountTransferredFee.plus(transfer.amount);
          }
        }
        const amountSpentFee = order.tokenSpendableFee.initialAmount.minus(order.tokenSpendableFee.amount);
        // amountTransferred could be less than amountSpent because of rebates
        assert(amountSpentFee.gte(amountTransferredFee), "amountSpentFee >= amountTransferredFee");
      }
    }

    // Check if the allOrNone orders were correctly filled
    for (const order of orders) {
      if (order.allOrNone) {
        assert(order.filledAmountS.eq(0) || order.filledAmountS.eq(order.amountS),
               "allOrNone orders should either be completely filled or not at all.");
      }
    }
  }
}
